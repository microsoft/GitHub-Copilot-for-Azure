#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const snapshotPath = path.resolve(__dirname, "../fixtures/azure-mcp-tool-names.snapshot.json");

function runAzureMcp(args) {
  return execFileSync("npx", ["-y", "@azure/mcp", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listServerTools() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "@azure/mcp", "server", "start"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting for Azure MCP server tools list."));
    }, 30_000);

    const cleanup = () => {
      clearTimeout(timeout);
      child.removeAllListeners();
    };

    const send = (payload) => {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    };

    child.stderr.on("data", (chunk) => {
      // Keep stderr drains to avoid potential backpressure deadlocks.
      chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `Azure MCP server exited before returning tools (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
    });

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let newlineIndex = buffer.indexOf("\n");

      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        if (!line) continue;

        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }

        if (message.id === 1) {
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
          continue;
        }

        if (message.id === 2) {
          if (settled) return;
          settled = true;
          cleanup();

          const names = [...new Set((message.result?.tools ?? []).map((tool) => tool.name))].sort();
          if (names.length === 0) {
            reject(new Error("Azure MCP server returned an empty tools list."));
            return;
          }

          resolve(names);
          child.kill("SIGTERM");
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "github-copilot-for-azure-snapshot-updater",
          version: "1.0.0",
        },
      },
    });
  });
}

async function main() {
  const version = runAzureMcp(["--version"]);
  const toolNames = await listServerTools();

  const snapshot = {
    source: "npx -y @azure/mcp server start (initialize + tools/list)",
    azureMcpVersion: version,
    toolNames,
  };

  mkdirSync(path.dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated MCP tool snapshot with ${toolNames.length} tools at ${snapshotPath}`);
}

await main();
