import { redactSecrets } from "../redact";

describe("redactSecrets", () => {
  test("redacts JWT tokens", () => {
    const input = [
      "start",
      "Authorization payload: eyJabcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "Authorization payload: [REDACTED]",
      "end"
    ].join("\n"));
  });

  test("redacts bearer tokens", () => {
    const input = [
      "start",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890._-~+/",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "Authorization: [REDACTED]",
      "end"
    ].join("\n"));
  });

  test("redacts GitHub tokens", () => {
    const input = [
      "start",
      "token=ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "token=[REDACTED]",
      "end"
    ].join("\n"));
  });

  test("redacts Azure SAS signatures", () => {
    const input = [
      "start",
      "url=https://example.blob.core.windows.net/c?sv=1&sig = AbCdEfGhIjKlMnOpQrStUvWxYz0123456789%2F%2B",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "url=https://example.blob.core.windows.net/c?sv=1&[REDACTED]",
      "end"
    ].join("\n"));
  });

  test("redacts key-value style secret values while preserving keys", () => {
    const input = [
      "start",
      "password=myVerySecret123 token: anotherSecret456 api-key=superSecret789 connection-string=Endpoint=sb://foo;SharedAccessKey=bar",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "password=[REDACTED] token: [REDACTED] api-key=[REDACTED] connection-string=[REDACTED]",
      "end"
    ].join("\n"));
  });

  test("does not redact non-secret or short values", () => {
    const input = [
      "start",
      "status=ok password=short token=tiny",
      "end"
    ].join("\n");

    expect(redactSecrets(input)).toBe([
      "start",
      "status=ok password=short token=tiny",
      "end"
    ].join("\n"));
  });
});