import { DefaultAzureCredential } from "@azure/identity";
import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";

export function getProfileEnvironment(
  profile: "stage" | "read" | "write" | "admin" | "none",
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (env.CI !== "true" && env.TEST_PERMISSION === undefined) {
    return { ...env };
  }
  const variable = `AZURE_${profile.toUpperCase()}_CONFIG_DIR`;
  const directory = env[variable]?.trim();
  if (!directory || !isAbsolute(directory)) {
    throw new Error(`${variable} must be an absolute Azure CLI profile path`);
  }
  const clientId = profile === "stage" ? env.AZURE_STAGE_CLIENT_ID?.trim() : profile === "none"
    ? "" : env[`AZURE_${profile.toUpperCase()}_CLIENT_ID`]?.trim();
  if (profile !== "none" && !clientId) {
    throw new Error(`Missing Azure client ID for ${profile} profile`);
  }
  return { ...env, AZURE_CONFIG_DIR: directory, AZURE_CLIENT_ID: clientId };
}

export function createStageCredential() {
  return createProfileCredential("stage");
}

export function createWriteCredential() {
  return createProfileCredential("write");
}

function createProfileCredential(profile: "stage" | "write") {
  if (process.env.CI !== "true") {
    return new DefaultAzureCredential();
  }
  const env = getProfileEnvironment(profile);
  return {
    async getToken(scopes: string | string[]) {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          process.platform === "win32" ? "az.cmd" : "az",
          ["account", "get-access-token", "--scope", ...(typeof scopes === "string" ? [scopes] : scopes),
            "--query", "{token:accessToken,expires:expires_on}", "--output", "json"],
          { env, encoding: "utf8", timeout: 30_000, shell: process.platform === "win32" },
          (error, output) => {
            if (error) {
              reject(error);
            } else {
              resolve(output);
            }
          },
        );
      });
      const result: unknown = JSON.parse(stdout);
      if (typeof result !== "object" || result === null
        || !("token" in result) || typeof result.token !== "string" || !result.token
        || !("expires" in result) || !Number.isFinite(Number(result.expires)) || Number(result.expires) <= 0) {
        throw new Error(`${profile} profile returned an invalid access token`);
      }
      return { token: result.token, expiresOnTimestamp: Number(result.expires) * 1000 };
    },
  };
}
