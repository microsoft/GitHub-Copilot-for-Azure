import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractRemoteLinks } from "../link-helpers.js";

const tempDirs: string[] = [];

function createMarkdown(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "remote-links-"));
  tempDirs.push(dir);
  const filePath = join(dir, "sample.md");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("extractRemoteLinks", () => {
  it("extracts plain URLs and markdown target URLs", () => {
    const mdFile = createMarkdown(
      [
        "Plain URL: https://example.com/a/b?query=1#top",
        "Markdown URL: [docs](http://docs.example.org/guide/intro)",
      ].join("\n")
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toEqual([
      {
        line: 1,
        link: "https://example.com/a/b?query=1#top",
        protocol: "https",
        host: "example.com",
        path: "/a/b",
      },
      {
        line: 2,
        link: "http://docs.example.org/guide/intro",
        protocol: "http",
        host: "docs.example.org",
        path: "/guide/intro",
      },
    ]);
  });

  it("handles malformed placeholder URLs with fallback parsing", () => {
    const mdFile = createMarkdown(
      "Use placeholder URL: https://{tenant}.host.com/path/to/page?debug=true"
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      protocol: "https",
      host: "{tenant}.host.com",
      path: "/path/to/page",
    });
  });

  it("captures URLs from markdown labels and trims trailing punctuation", () => {
    const mdFile = createMarkdown(
      "See [https://label.example.com/reference](./local.md) and (https://api.example.com/v1/path)."
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      link: "https://label.example.com/reference",
      host: "label.example.com",
      path: "/reference",
    });
    expect(links[1]).toMatchObject({
      link: "https://api.example.com/v1/path",
      host: "api.example.com",
      path: "/v1/path",
    });
  });

  it("captures placeholder hosts that include indexed expressions", () => {
    const mdFile = createMarkdown(
      "Terraform output: https://${azurerm_container_app.api.ingress[0].fqdn}"
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      link: "https://${azurerm_container_app.api.ingress[0].fqdn}",
      protocol: "https",
      host: "${azurerm_container_app.api.ingress[0].fqdn}",
      path: "/",
    });
  });

  it("trims a trailing backtick from extracted urls", () => {
    const mdFile = createMarkdown(
      "Key Vault endpoint: https://${vaultName}.vault.azure.net`"
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      link: "https://${vaultName}.vault.azure.net",
      protocol: "https",
      host: "${vaultname}.vault.azure.net",
      path: "/",
    });
  });

  it("allows whitespace inside balanced shell substitutions", () => {
    const mdFile = createMarkdown(
      "Health check: https://$(terraform output -raw api_url)/health"
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      link: "https://$(terraform output -raw api_url)/health",
      protocol: "https",
      host: "$(terraform output -raw api_url)",
      path: "/health",
    });
  });

  it("stops URL extraction at semicolons", () => {
    const mdFile = createMarkdown(
      "Connection string: http://localhost:8080;Authentication=None;TaskHub=default"
    );

    const links = extractRemoteLinks(mdFile, "");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      link: "http://localhost:8080",
      protocol: "http",
      host: "localhost:8080",
      path: "/",
    });
  });
});
