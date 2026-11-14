import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Report = {
  mode: string;
  status: string;
  audio?: {
    container: string;
    wavFormat?: { codec: string; sampleRate: number; bitsPerSample: number; channels: number; isExtensible: boolean };
    dataChunk?: { declaredBytes: number; truncated: boolean; firstWindowAllZero?: boolean; estimatedDurationSeconds?: number };
  };
  batchTranscriptionFiles?: {
    retainedEntries: number;
    paginationComplete: boolean;
    kindCounts: Record<string, number>;
    transcriptionResultFiles: number;
    transcriptionReportListed: boolean;
  };
  batchTranscriptionReport?: {
    successfulTranscriptionsCount?: number;
    failedTranscriptionsCount: number;
    detailEntries: number;
  };
  batchSynthesis?: {
    jobStatus: string;
    succeededAudioCount?: number;
    failedAudioCount?: number;
  };
  findings: Array<{ code: string; severity: string }>;
};

const script = process.env.SPEECH_AUDIO_INSPECTOR_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/inspect-speech-audio.mjs", import.meta.url,
));
const { inspectSpeechAudio } = (await import(pathToFileURL(script).href)) as {
  inspectSpeechAudio: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_PRIVATE_CONTENT_DO_NOT_EMIT";
const isWindows = process.platform === "win32";

function resolveExecutable(command: string): string | undefined {
  try {
    return execFileSync(isWindows ? "where.exe" : "which", [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return undefined;
  }
}

function makeWav({
  formatTag = 1,
  channels = 1,
  sampleRate = 16000,
  bitsPerSample = 16,
  declaredDataBytes = 320,
  payloadBytes = 320,
  fillByte = 0x12,
} = {}): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + payloadBytes, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(formatTag, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  const blockAlign = channels * (bitsPerSample / 8);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(declaredDataBytes, 40);
  const data = Buffer.alloc(payloadBytes, fillByte);
  return Buffer.concat([header, data]);
}

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "speech-audio-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it("validates 16kHz PCM WAV and catches silence, float WAV, truncation, and MP3-in-.wav", async () => {
  await withTempDir(async (dir) => {
    const cleanWav = join(dir, "clean.wav");
    await writeFile(cleanWav, makeWav());
    const ok = await inspectSpeechAudio({ file: cleanWav, mode: "realtime-sdk" });
    expect(ok.status).toBe("passed_local_checks");
    expect(ok.audio?.wavFormat?.codec).toBe("pcm");
    expect(ok.audio?.dataChunk?.firstWindowAllZero).toBe(false);

    const silentWav = join(dir, "silent.wav");
    await writeFile(silentWav, makeWav({ fillByte: 0x00 }));
    const silent = await inspectSpeechAudio({ file: silentWav, mode: "realtime-sdk" });
    expect(silent.findings.map((f) => f.code)).toContain("LEADING_DIGITAL_SILENCE");

    const floatWav = join(dir, "float.wav");
    await writeFile(floatWav, makeWav({ formatTag: 3, bitsPerSample: 32 }));
    const floatRes = await inspectSpeechAudio({ file: floatWav, mode: "realtime-sdk" });
    expect(floatRes.findings.map((f) => f.code)).toContain("NON_PCM_WAV_FOR_REALTIME_SDK");

    const truncWav = join(dir, "truncated.wav");
    await writeFile(truncWav, makeWav({ declaredDataBytes: 64000, payloadBytes: 100 }));
    const trunc = await inspectSpeechAudio({ file: truncWav, mode: "realtime-sdk" });
    expect(trunc.status).toBe("passed_with_warnings");
    expect(trunc.findings.find((f) => f.code === "TRUNCATED_WAV_DATA_CHUNK")?.severity).toBe("warning");

    const mp3AsWav = join(dir, "disguised.wav");
    await writeFile(mp3AsWav, Buffer.from(`ID3\x04\x00\x00\x00\x00\x00\x10${SECRET}`, "latin1"));
    const mismatch = await inspectSpeechAudio({ file: mp3AsWav, mode: "realtime-sdk" });
    expect(mismatch.status).toBe("failed_preflight");
    expect(mismatch.findings.map((f) => f.code)).toContain("WAV_EXTENSION_CONTAINER_MISMATCH");
    expect(JSON.stringify(mismatch)).not.toContain(SECRET);

    // Fast/Batch REST accept compressed formats, so a renamed MP3 is only informational there.
    const restMismatch = await inspectSpeechAudio({ file: mp3AsWav, mode: "fast-transcription" });
    expect(restMismatch.status).not.toBe("failed_preflight");
    expect(restMismatch.findings.find((f) => f.code === "WAV_EXTENSION_CONTAINER_MISMATCH")?.severity).toBe("info");

    const mystery = join(dir, "mystery.raw");
    await writeFile(mystery, Buffer.from([0x12, 0x34, 0x56, 0x78]));
    expect((await inspectSpeechAudio({ file: mystery })).status).toBe("unknown");
  });
});

it("finds WAV data past large chunks and flags header-only or data-less WAV files", async () => {
  await withTempDir(async (dir) => {
    // 300 KiB LIST chunk before data (beyond any fixed header window), 1 hour of 16 kHz PCM declared.
    const pcm = makeWav({ payloadBytes: 320 });
    const listBody = Buffer.alloc(300 * 1024, 0x41);
    const listHeader = Buffer.alloc(8);
    listHeader.write("LIST", 0, "ascii");
    listHeader.writeUInt32LE(listBody.length, 4);
    const withList = Buffer.concat([pcm.subarray(0, 36), listHeader, listBody, pcm.subarray(36)]);
    const listWav = join(dir, "list-before-data.wav");
    await writeFile(listWav, withList);
    const listed = await inspectSpeechAudio({ file: listWav, mode: "fast-transcription" });
    expect(listed.status).toBe("passed_local_checks");
    expect(listed.audio?.dataChunk?.declaredBytes).toBe(320);
    expect(listed.findings.map((f) => f.code)).not.toContain("DURATION_NOT_DETERMINED");

    // WAVE_FORMAT_EXTENSIBLE with PCM sub-format is PCM.
    const ext = Buffer.alloc(68);
    ext.write("RIFF", 0, "ascii"); ext.writeUInt32LE(60, 4); ext.write("WAVE", 8, "ascii");
    ext.write("fmt ", 12, "ascii"); ext.writeUInt32LE(40, 16); ext.writeUInt16LE(0xfffe, 20);
    ext.writeUInt16LE(1, 22); ext.writeUInt32LE(16000, 24); ext.writeUInt32LE(32000, 28);
    ext.writeUInt16LE(2, 32); ext.writeUInt16LE(16, 34); ext.writeUInt16LE(22, 36);
    ext.writeUInt16LE(16, 38); ext.writeUInt16LE(0x0001, 44);
    ext.write("data", 60, "ascii"); ext.writeUInt32LE(0, 64);
    const extWav = join(dir, "extensible.wav");
    await writeFile(extWav, Buffer.concat([ext.subarray(0, 64), Buffer.from([4, 0, 0, 0, 1, 2, 3, 4])]));
    const extRes = await inspectSpeechAudio({ file: extWav, mode: "realtime-sdk" });
    expect(extRes.audio?.wavFormat?.codec).toBe("pcm");
    expect(extRes.audio?.wavFormat?.isExtensible).toBe(true);

    const headerOnly = join(dir, "header-only.wav");
    await writeFile(headerOnly, makeWav({ declaredDataBytes: 0, payloadBytes: 0 }));
    const empty = await inspectSpeechAudio({ file: headerOnly, mode: "realtime-sdk" });
    expect(empty.status).toBe("failed_preflight");
    expect(empty.findings.map((f) => f.code)).toContain("EMPTY_WAV_DATA_CHUNK");

    const noData = join(dir, "no-data.wav");
    await writeFile(noData, makeWav().subarray(0, 36));
    const missing = await inspectSpeechAudio({ file: noData, mode: "fast-transcription" });
    expect(missing.status).toBe("failed_preflight");
    expect(missing.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(["MISSING_WAV_DATA_CHUNK", "DURATION_NOT_DETERMINED"]),
    );
  });
});

it("reads batch transcription List Files and report JSON without leaking SAS URLs or text", async () => {
  await withTempDir(async (dir) => {
    // Real List Files shape: one Transcription per successful input + one TranscriptionReport, no per-file status.
    const filesJson = join(dir, "files.json");
    await writeFile(filesJson, JSON.stringify({
      values: [
        {
          self: `https://example.cognitiveservices.azure.com/files/1?sig=${SECRET}`,
          name: "contenturl_0.json",
          kind: "Transcription",
          properties: { size: 3407 },
          links: { contentUrl: `https://blob.example/file?sv=1&sig=${SECRET}` },
        },
        {
          name: "report.json",
          kind: "TranscriptionReport",
          properties: { size: 397 },
          links: { contentUrl: `https://blob.example/report?sig=${SECRET}` },
        },
      ],
    }));
    const list = await inspectSpeechAudio({ file: filesJson, mode: "batch-transcription-files" });
    expect(list.status).toBe("unknown");
    expect(list.batchTranscriptionFiles?.transcriptionResultFiles).toBe(1);
    expect(list.batchTranscriptionFiles?.transcriptionReportListed).toBe(true);
    expect(list.findings.map((f) => f.code)).toContain("FAILURES_ONLY_IN_TRANSCRIPTION_REPORT");
    expect(JSON.stringify(list)).not.toContain(SECRET);

    const paged = join(dir, "files-page1.json");
    await writeFile(paged, JSON.stringify({
      values: [{ kind: "Transcription", name: "a.json" }],
      "@nextLink": `https://example.cognitiveservices.azure.com/next?sig=${SECRET}`,
    }));
    const page = await inspectSpeechAudio({ file: paged, mode: "batch-transcription-files" });
    expect(page.findings.map((f) => f.code)).toContain("PAGINATED_FILES_INCOMPLETE");
    expect(page.batchTranscriptionFiles?.paginationComplete).toBe(false);

    const reportJson = join(dir, "report.json");
    await writeFile(reportJson, JSON.stringify({
      successfulTranscriptionsCount: 1,
      failedTranscriptionsCount: 1,
      details: [
        { source: `https://blob.example/ok.wav?sig=${SECRET}`, status: "Succeeded" },
        { source: `https://blob.example/${SECRET}.wav?sig=${SECRET}`, status: "Failed" },
      ],
    }));
    const report = await inspectSpeechAudio({ file: reportJson, mode: "batch-transcription-files" });
    expect(report.status).toBe("failed_preflight");
    expect(report.batchTranscriptionReport?.failedTranscriptionsCount).toBe(1);
    expect(report.batchTranscriptionReport?.detailEntries).toBe(2);
    expect(report.findings.map((f) => f.code)).toContain("BATCH_FILE_FAILURES_PRESENT");
    expect(JSON.stringify(report)).not.toContain(SECRET);

    const synthJson = join(dir, "synth.json");
    await writeFile(synthJson, JSON.stringify({
      id: "job-01",
      status: "Succeeded",
      inputKind: "SSML",
      properties: { succeededAudioCount: 4, failedAudioCount: 1 },
      outputs: { result: `https://blob.example/results.zip?sig=${SECRET}` },
    }));
    const synthRes = await inspectSpeechAudio({ file: synthJson, mode: "batch-synthesis-job" });
    expect(synthRes.findings.map((f) => f.code)).toContain("PARTIAL_SYNTHESIS_FAILURES");
    expect(JSON.stringify(synthRes)).not.toContain(SECRET);
  });
});

const launchers = [
  {
    name: "Bash",
    executable: isWindows ? undefined : resolveExecutable("bash"),
    file: "inspect-speech-audio.sh",
    args: (file: string, ...rest: string[]) => [file, ...rest],
  },
  {
    name: "PowerShell",
    executable: resolveExecutable(isWindows ? "powershell" : "pwsh"),
    file: "inspect-speech-audio.ps1",
    args: (file: string, ...rest: string[]) => ["-NoProfile", "-File", file, ...rest],
  },
];

for (const launcher of launchers) {
  it.skipIf(!launcher.executable)(`${launcher.name} launcher enforces Node.js 22+ preflight`, async () => {
    await withTempDir(async (dir) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
      const noNodePath = isWindows ? [dir, join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(delimiter) : dir;
      const missing = spawnSync(launcher.executable as string, launcher.args(join(dirname(script), launcher.file), "--help"), {
        encoding: "utf8",
        env: { ...env, PATH: noNodePath },
      });
      expect(missing.status).toBe(3);
      expect(JSON.parse(missing.stderr).error).toBe("NODE_REQUIRED");

      if (isWindows) {
        await writeFile(join(dir, "node.cmd"), "@echo v18.0.0\r\n");
      } else {
        await writeFile(join(dir, "node"), "#!/bin/sh\necho v18.0.0\n");
        await chmod(join(dir, "node"), 0o755);
      }
      const old = spawnSync(launcher.executable as string, launcher.args(join(dirname(script), launcher.file), "--help"), {
        encoding: "utf8",
        env: { ...env, PATH: noNodePath },
      });
      expect(old.status).toBe(3);
      expect(JSON.parse(old.stderr).error).toBe("NODE_VERSION_UNSUPPORTED");
    });
  });
}
