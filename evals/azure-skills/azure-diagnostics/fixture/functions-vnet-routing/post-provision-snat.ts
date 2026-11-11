import { provisionFixture } from "./post-provision.ts";

void provisionFixture("snat-pressure").catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
