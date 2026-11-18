import { readFileSync, statSync } from "node:fs";

export function decodeJsonText(buffer) {
  const encoding = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe
    ? "utf-16le"
    : buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff
      ? "utf-16be"
      : "utf-8";
  return new TextDecoder(encoding, { fatal: true }).decode(buffer);
}

export function readJsonFile(path, maxBytes) {
  const info = statSync(path);
  if (!info.isFile()) throw new Error("NOT_A_FILE");
  if (info.size > maxBytes) throw new Error("FILE_TOO_LARGE");
  return JSON.parse(decodeJsonText(readFileSync(path)));
}
