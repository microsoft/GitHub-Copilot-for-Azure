import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptDirectory = fileURLToPath(new URL(
  "../../plugins/azure-skills/skills/azure-prepare/references/services/sql-database/scripts/",
  import.meta.url,
));

function bashPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
}

const shells = [
  { command: "bash", extension: "sh" },
  { command: process.platform === "win32" ? "powershell" : "pwsh", extension: "ps1" },
];

for (const shell of shells) {
  const isBash = shell.extension === "sh";
  const available = !spawnSync(shell.command, isBash
    ? ["--version"]
    : ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
  ).error;

  describe.skipIf(!available)(`grant-sql-access.${shell.extension}`, () => {
    function run(
      values: Record<string, string>,
      options: { azdExit?: number; sqlExit?: number; crlf?: boolean; singleQuotes?: boolean } = {},
    ) {
      const directory = mkdtempSync(join(tmpdir(), "grant-sql-access-"));
      const envFile = join(directory, "azd-env.txt");
      const captureFile = join(directory, "sqlcmd-args.txt");
      const quote = options.singleQuotes ? "'" : '"';
      writeFileSync(envFile, Object.entries({
        SQL_SERVER: "test-server",
        SQL_DATABASE: "test-db",
        ...values,
      }).map(([key, value]) => `${key}=${quote}${value}${quote}`).join(options.crlf ? "\r\n" : "\n"));

      const env = { ...process.env };
      for (const key of Object.keys(env)) {
        if (["SERVICE_WEB_NAME", "SERVICE_API_NAME", "SQL_GRANT_DDLADMIN"].includes(key.toUpperCase())) {
          delete env[key];
        }
      }
      Object.assign(env, {
        SQL_TEST_ENV: isBash ? bashPath(envFile) : envFile,
        SQL_TEST_CAPTURE: isBash ? bashPath(captureFile) : captureFile,
        SQL_TEST_SCRIPT: isBash
          ? bashPath(join(scriptDirectory, `grant-sql-access.${shell.extension}`))
          : join(scriptDirectory, `grant-sql-access.${shell.extension}`),
        SQL_TEST_AZD_EXIT: String(options.azdExit ?? 0),
        SQL_TEST_SQL_EXIT: String(options.sqlExit ?? 0),
        SQL_TEST_PAYLOAD: "app'; SELECT 1; --",
      });

      const harness = isBash ? `
azd() {
  cat -- "$SQL_TEST_ENV"
  return "$SQL_TEST_AZD_EXIT"
}
sqlcmd() {
  printf '%s\\0' "$@" > "$SQL_TEST_CAPTURE"
  return "$SQL_TEST_SQL_EXIT"
}
source "$SQL_TEST_SCRIPT"
` : `
function azd {
  Get-Content -LiteralPath $env:SQL_TEST_ENV -Encoding UTF8
  $global:LASTEXITCODE = [int]$env:SQL_TEST_AZD_EXIT
}
function sqlcmd {
  ConvertTo-Json -InputObject @($args) | Set-Content -LiteralPath $env:SQL_TEST_CAPTURE -Encoding UTF8
  $global:LASTEXITCODE = [int]$env:SQL_TEST_SQL_EXIT
}
& $env:SQL_TEST_SCRIPT
`;

      try {
        const result = spawnSync(shell.command, isBash
          ? ["--noprofile", "--norc", "-c", harness]
          : ["-NoProfile", "-NonInteractive", "-Command", harness], {
          env,
          encoding: "utf8",
          timeout: 30_000,
        });
        if (result.error) throw result.error;
        const captured = existsSync(captureFile) ? readFileSync(captureFile, "utf8") : undefined;
        const args: string[] | undefined = captured === undefined ? undefined : isBash
          ? captured.split("\0").slice(0, -1)
          : JSON.parse(captured.replace(/^\uFEFF/, ""));
        return { ...result, args, query: args?.[args.indexOf("-Q") + 1] };
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }

    const identityCases: Record<string, string>[] = [
      { SERVICE_WEB_NAME: "web-app", SERVICE_API_NAME: "api-app" },
      { SERVICE_API_NAME: "api-app" },
      { SERVICE_WEB_NAME: "", SERVICE_API_NAME: "api-app" },
    ];
    it.each(identityCases)("selects the correct identity from %j", (values) => {
      const result = run(values);
      const name = values.SERVICE_WEB_NAME || values.SERVICE_API_NAME;
      expect(result.status).toBe(0);
      expect(result.args).toEqual([
        "-S", "test-server.database.windows.net",
        "-d", "test-db",
        "--authentication-method", "ActiveDirectoryDefault",
        "-x", "-b", "-Q", result.query,
      ]);
      expect(result.query).toContain(`WHERE name = N'${name}'`);
      expect(result.query).toContain(`CREATE USER [${name}] FROM EXTERNAL PROVIDER;`);
      for (const role of ["db_datareader", "db_datawriter"]) {
        expect(result.query).toContain(`WHERE r.name = '${role}' AND m.name = N'${name}'`);
        expect(result.query).toContain(`ALTER ROLE ${role} ADD MEMBER [${name}];`);
      }
      expect(result.query).not.toContain("db_ddladmin");
      expect(result.stdout).toContain("SQL access granted successfully.");
    });

    it.each(["web", "api"])("grants optional ddladmin for the %s identity", (service) => {
      const result = run({
        [service === "web" ? "SERVICE_WEB_NAME" : "SERVICE_API_NAME"]: "test-app",
        SQL_GRANT_DDLADMIN: "true",
      });
      expect(result.status).toBe(0);
      expect(result.query).toContain("WHERE r.name = 'db_ddladmin' AND m.name = N'test-app'");
      expect(result.query).toContain("ALTER ROLE db_ddladmin ADD MEMBER [test-app];");
    });

    it.each(["ab", "1A", "App--01", "a".repeat(60)])("accepts supported name %s", (name) => {
      const result = run({ SERVICE_WEB_NAME: name });
      expect(result.status).toBe(0);
      expect(result.query).toContain(`CREATE USER [${name}] FROM EXTERNAL PROVIDER;`);
    });

    it.each([
      "a",
      "a".repeat(61),
      "-app",
      "app-",
      "victim-app'; SELECT 1 AS INJECTED_MARKER; --",
      "x') PRINT N'PROBE'; IF NOT EXISTS (SELECT 1 WHERE 'a'='a",
      "app]; SELECT 1; --",
      "$(SQL_TEST_PAYLOAD)",
      "app_name",
      "app.name",
      "app name",
      "app\nGO\nSELECT 1",
      "app\n",
      "app\r",
      "app\r\n",
      "app\t",
      "caf\u00e9",
      '"',
    ])("rejects invalid name %j before invoking sqlcmd", (name) => {
      for (const service of ["SERVICE_WEB_NAME", "SERVICE_API_NAME"]) {
        const result = run({ [service]: name, SQL_GRANT_DDLADMIN: "true" });
        expect(result.status).toBe(1);
        expect(result.args).toBeUndefined();
        expect(result.stderr).not.toBe("");
        expect(result.stdout).not.toContain("SQL access granted successfully.");
      }
    });

    it("does not fall back to the API name when the web name is invalid", () => {
      const result = run({ SERVICE_WEB_NAME: "bad'name", SERVICE_API_NAME: "valid-api" });
      expect(result.status).toBe(1);
      expect(result.args).toBeUndefined();
    });

    it("fails when both names are missing", () => {
      const result = run({});
      expect(result.status).toBe(1);
      expect(result.stderr.replace(/\s+/g, " ")).toContain("Neither SERVICE_WEB_NAME nor SERVICE_API_NAME");
      expect(result.args).toBeUndefined();
    });

    it.each([{ crlf: true }, { singleQuotes: true }])("loads azd output with %j", (options) => {
      const result = run({ SERVICE_WEB_NAME: "test-app" }, options);
      expect(result.status).toBe(0);
      expect(result.query).toContain("CREATE USER [test-app] FROM EXTERNAL PROVIDER;");
    });

    it("does not execute SQL when azd returns partial output and fails", () => {
      const result = run({ SERVICE_WEB_NAME: "test-app" }, { azdExit: 9 });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Failed to read azd environment values");
      expect(result.args).toBeUndefined();
    });

    it("propagates SQL failures without reporting success", () => {
      const result = run({ SERVICE_WEB_NAME: "test-app" }, { sqlExit: 9 });
      expect(result.status).toBe(1);
      expect(result.args).toContain("-b");
      expect(result.stdout).not.toContain("SQL access granted successfully.");
    });
  });
}
