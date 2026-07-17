import { describe, it, expect } from "vitest";
import { telemetryUrl } from "../App";

describe("telemetryUrl", () => {
    it("builds the dashboard URL for a skill name", () => {
        expect(telemetryUrl("azure-deploy")).toBe(
            "https://dataexplorer.azure.com/dashboards/d1281268-c49e-4e82-bdc9-79e6c3c6cb43" +
                "?p-_startTime=90days&p-_endTime=now&p-_selectedPluginSkill=v-azure-deploy" +
                "#e9eade80-7b12-49db-a865-a6d3365d03eb",
        );
    });

    it("encodes the skill name into the selectedPluginSkill parameter", () => {
        const url = new URL(telemetryUrl("azure-cost-management"));
        expect(url.searchParams.get("p-_selectedPluginSkill")).toBe("v-azure-cost-management");
        expect(url.searchParams.get("p-_startTime")).toBe("90days");
        expect(url.searchParams.get("p-_endTime")).toBe("now");
        expect(url.hash).toBe("#e9eade80-7b12-49db-a865-a6d3365d03eb");
    });
});
