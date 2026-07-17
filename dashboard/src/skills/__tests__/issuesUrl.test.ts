import { describe, it, expect } from "vitest";
import { issuesUrl } from "../App";

describe("issuesUrl", () => {
    it("points at the repo's issue search", () => {
        expect(issuesUrl("azure-deploy")).toContain(
            "https://github.com/microsoft/GitHub-Copilot-for-Azure/issues?q=",
        );
    });

    it("filters to open issues labelled with the skill name", () => {
        const url = issuesUrl("azure-deploy");
        const query = new URL(url).searchParams.get("q");
        expect(query).toBe('is:issue state:open label:"azure-deploy"');
    });

    it("url-encodes skill names with special characters", () => {
        const url = issuesUrl("foundry agent/create");
        // Raw skill name must not appear unencoded in the URL.
        expect(url).not.toContain("foundry agent/create");
        const query = new URL(url).searchParams.get("q");
        expect(query).toBe('is:issue state:open label:"foundry agent/create"');
    });
});
