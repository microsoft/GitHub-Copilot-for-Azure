import { describe, it, expect } from "vitest";
import { telemetryUrl } from "../App";

describe("telemetryUrl", () => {
    it("builds the dashboard URL for a skill name", () => {
        const url = new URL(telemetryUrl("azure-deploy"));
        expect(url.origin).toBe("https://dataexplorer.azure.com");
        expect(url.pathname).toBe("/dashboards/d1281268-c49e-4e82-bdc9-79e6c3c6cb43");
        expect(url.searchParams.get("p-_startTime")).toBe("90days");
        expect(url.searchParams.get("p-_endTime")).toBe("now");
        expect(url.searchParams.get("p-_selectedPluginSkill")).toBe("v-azure-deploy");
        expect(url.hash).toBe("#e9eade80-7b12-49db-a865-a6d3365d03eb");
    });

    it("encodes the skill name into the selectedPluginSkill parameter", () => {
        const url = new URL(telemetryUrl("azure-cost-management"));
        expect(url.searchParams.get("p-_selectedPluginSkill")).toBe("v-azure-cost-management");
        expect(url.searchParams.get("p-_startTime")).toBe("90days");
        expect(url.searchParams.get("p-_endTime")).toBe("now");
        expect(url.hash).toBe("#e9eade80-7b12-49db-a865-a6d3365d03eb");
    });
});
