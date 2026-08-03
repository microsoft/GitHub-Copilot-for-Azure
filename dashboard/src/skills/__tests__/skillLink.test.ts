import { describe, it, expect } from "vitest";
import { skillMdUrl, skillsFromHealthData } from "../App";

const BASE = "https://github.com/microsoft/GitHub-Copilot-for-Azure/blob/main";

describe("skillMdUrl", () => {
    it("maps a built output path back to the plugin source", () => {
        expect(skillMdUrl("output/skills/azure-deploy/SKILL.md")).toBe(
            `${BASE}/plugin/skills/azure-deploy/SKILL.md`,
        );
    });

    it("passes through a plugin source path unchanged", () => {
        expect(skillMdUrl("plugin/skills/azure-prepare/SKILL.md")).toBe(
            `${BASE}/plugin/skills/azure-prepare/SKILL.md`,
        );
    });

    it("handles nested skill folders", () => {
        expect(
            skillMdUrl("output/skills/microsoft-foundry/foundry-agent/create/SKILL.md"),
        ).toBe(
            `${BASE}/plugin/skills/microsoft-foundry/foundry-agent/create/SKILL.md`,
        );
    });

    it("normalizes backslash separators", () => {
        expect(skillMdUrl("output\\skills\\azure-deploy\\SKILL.md")).toBe(
            `${BASE}/plugin/skills/azure-deploy/SKILL.md`,
        );
    });

    it("returns null for a missing or empty path", () => {
        expect(skillMdUrl("")).toBeNull();
    });

    it("returns null for a non-SKILL.md path", () => {
        expect(skillMdUrl("plugin/skills/azure-deploy/references/foo.md")).toBeNull();
    });

    it("returns null for a path outside the skills tree", () => {
        expect(skillMdUrl("docs/SKILL.md")).toBeNull();
    });
});

describe("skillsFromHealthData", () => {
    it("captures the path for each plugin skill", () => {
        const skills = skillsFromHealthData({
            categories: {
                frontmatter: {
                    items: [
                        {
                            name: "azure-deploy",
                            metadata: {
                                path: "output/skills/azure-deploy/SKILL.md",
                                description: "Deploy skill",
                            },
                        },
                        {
                            name: "not-a-skill",
                            metadata: { path: "docs/readme.md" },
                        },
                    ],
                },
            },
        });
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("azure-deploy");
        expect(skills[0].path).toBe("output/skills/azure-deploy/SKILL.md");
        expect(skillMdUrl(skills[0].path)).toBe(
            `${BASE}/plugin/skills/azure-deploy/SKILL.md`,
        );
    });
});
