import { provisionFixture } from "./post-provision.ts";

void provisionFixture("dns-unlinked").catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
