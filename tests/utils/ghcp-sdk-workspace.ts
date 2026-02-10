/**
 * GHCP SDK Workspace Setup
 *
 * Creates a minimal Copilot Extension app using @copilot-extensions/preview-sdk
 * in a test workspace. Used as the starting point for deployment scenarios.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Write a minimal Copilot SDK Express app into the workspace.
 * Gives the agent a concrete app to deploy rather than starting from zero.
 */
export async function setupCopilotSdkApp(workspace: string): Promise<void> {
  // package.json
  const packageJson = {
    name: "copilot-extension-app",
    version: "1.0.0",
    description: "A GitHub Copilot Extension built with the preview SDK",
    main: "src/index.ts",
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "ts-node src/index.ts"
    },
    dependencies: {
      "@copilot-extensions/preview-sdk": "^5.0.0",
      "express": "^4.21.0"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/node": "^20.11.0",
      "typescript": "^5.3.3",
      "ts-node": "^10.9.2"
    }
  };
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true
    },
    include: ["src/**/*"]
  };
  fs.writeFileSync(
    path.join(workspace, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );

  // src/index.ts — minimal SSE streaming Copilot Extension
  const srcDir = path.join(workspace, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  const indexTs = `import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Copilot Extension agent endpoint (SSE streaming)
app.post("/agent", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const { messages } = req.body;
  const lastMessage = messages?.[messages.length - 1]?.content ?? "";

  // Echo response via SSE
  const response = \`You said: \${lastMessage}\`;
  res.write(\`data: {"choices":[{"delta":{"content":"\${response}"}}]}\\n\\n\`);
  res.write("data: [DONE]\\n\\n");
  res.end();
});

app.listen(PORT, () => {
  console.log(\`Copilot Extension listening on port \${PORT}\`);
});

export default app;
`;
  fs.writeFileSync(path.join(srcDir, "index.ts"), indexTs);

  // .gitignore
  const gitignore = `node_modules/
dist/
.env
*.log
`;
  fs.writeFileSync(path.join(workspace, ".gitignore"), gitignore);
}
