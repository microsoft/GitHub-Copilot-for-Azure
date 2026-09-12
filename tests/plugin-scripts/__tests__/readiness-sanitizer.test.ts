/**
 * Deterministic contract test for the AKS Automatic readiness sanitizer shipped in
 * plugins/azure-skills/skills/azure-kubernetes/azure-kubernetes-automatic-readiness/scripts.
 *
 * The filter is an allowlist projection: every field the constraint spec does not
 * evaluate (env values, envFrom, args, volume sources, non-AppArmor annotations,
 * managedFields, status, Secret/ConfigMap resources) must be absent from its output.
 * Requires `jq` on PATH; a missing tool is a hard failure, not a pass.
 */

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Jest runs with cwd = tests/ (see scripts/run-tests.js); resolve from there.
const testsRoot = process.cwd();
const repoRoot = path.resolve(testsRoot, "..");
const here = path.join(testsRoot, "plugin-scripts", "__tests__");
const filterPath = path.join(
  repoRoot,
  "plugins/azure-skills/skills/azure-kubernetes/azure-kubernetes-automatic-readiness/scripts/sanitize-readiness-input.jq",
);
const fixturePath = path.join(here, "..", "fixtures", "readiness-input.json");

interface Projected {
  kind: string;
  metadata: { name: string; namespace?: string; restrictedLabelKeys?: string[]; legacyAppArmorProfiles?: { container: string; valid: boolean }[] };
  spec?: Record<string, unknown>;
  provisioner?: string;
  selectorDuplicateCount?: number;
}

function runFilter(input = fs.readFileSync(fixturePath, "utf8")): { raw: string; items: Projected[] } {
  const result = spawnSync("jq", ["-f", filterPath], { input, encoding: "utf8" });
  if (result.error) {
    throw new Error(`jq is required to run the readiness sanitizer contract test: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`jq exited ${result.status}: ${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout) as { items: Projected[] };
  return { raw: result.stdout, items: parsed.items };
}

describe("sanitize-readiness-input.jq", () => {
  const { raw, items } = runFilter();
  const byKind = (kind: string) => items.filter((i) => i.kind === kind);
  const deployment = byKind("Deployment")[0];
  const podSpec = (deployment.spec as { template: { spec: Record<string, unknown> } }).template.spec;
  const containers = podSpec.containers as Record<string, unknown>[];
  const web = containers.find((c) => c.name === "web") as Record<string, unknown>;

  test("drops every sentinel the constraint spec never evaluates", () => {
    const sentinels = [
      "LABEL_SENTINEL", "METADATA_ANNOTATION_SENTINEL", "MANAGED_FIELDS_SENTINEL", "ANNOTATION_SENTINEL",
      "APPARMOR_NEAR_MATCH_SENTINEL", "APPARMOR_VALUE_SENTINEL", "ENV_SENTINEL", "SECRET_KEY_SENTINEL",
      "ENVFROM_SENTINEL", "ARGS_SENTINEL", "PROBE_HOST_SENTINEL", "HOSTPATH_SENTINEL", "SECRET_NAME_SENTINEL",
      "CONFIGMAP_NAME_SENTINEL", "STATUS_SENTINEL", "SC_PARAM_SENTINEL", "CRON_ENV_SENTINEL",
      "CONFIGMAP_DATA_SENTINEL", "U0VDUkVUX0RBVEFfU0VOVElORUw=",
    ];
    for (const s of sentinels) {
      expect(raw).not.toContain(s);
    }
  });

  test("drops Secret and ConfigMap resources entirely", () => {
    expect(byKind("Secret")).toHaveLength(0);
    expect(byKind("ConfigMap")).toHaveLength(0);
    expect(items.map((i) => i.kind).sort()).toEqual(["CronJob", "Deployment", "Service", "Service", "StorageClass"]);
  });

  test("keeps the fields the Baseline safeguards evaluate", () => {
    expect(podSpec.hostNetwork).toBe(true);
    expect(podSpec.podAntiAffinityConfigured).toBe(true);
    expect(web.ports).toEqual([{ containerPort: 8080, hostPort: 8080, protocol: "TCP" }]);
    expect(web.readinessProbeConfigured).toBe(true);
    expect(web.livenessProbeConfigured).toBe(false);
    expect(web.resources).toEqual({ requests: { cpu: "100m" } });
    const sc = web.securityContext as Record<string, unknown>;
    expect(sc.capabilities).toEqual({ add: ["NET_ADMIN"] }); // empty drop list is compacted away
    expect(sc.seccompProfile).toEqual({ type: "Unconfined" });
    expect(podSpec.volumes).toEqual([
      { name: "logs", types: ["hostPath"] },
      { name: "creds", types: ["secret"] },
      { name: "cfg", types: ["configMap"] },
    ]);
  });

  test("keeps the fields the conditional (Restricted/Windows) safeguards evaluate", () => {
    const sc = web.securityContext as Record<string, unknown>;
    expect(sc.allowPrivilegeEscalation).toBe(true);
    expect(sc.runAsUser).toBe(0);
    expect(sc.windowsOptions).toEqual({ runsAsContainerAdministrator: true });
  });

  test("projects image policy without exposing registries beyond the reference itself", () => {
    const policy = (name: string) => (containers.find((c) => c.name === name) as { imagePolicy: unknown }).imagePolicy;
    expect(policy("web")).toEqual({ usesLatestTag: false, pinned: true });
    expect(policy("sidecar")).toEqual({ usesLatestTag: true, pinned: false });
    expect(policy("pinned")).toEqual({ usesLatestTag: false, pinned: true });
    const cron = byKind("CronJob")[0].spec as { jobTemplate: { spec: { template: { spec: { containers: { imagePolicy: unknown }[] } } } } };
    expect(cron.jobTemplate.spec.template.spec.containers[0].imagePolicy).toEqual({ usesLatestTag: true, pinned: false });
  });

  test("keeps only reserved label keys and AppArmor annotation validity", () => {
    expect(deployment.metadata.restrictedLabelKeys).toEqual(["kubernetes.azure.com/agentpool"]);
    const tpl = (deployment.spec as { template: { metadata: Projected["metadata"] } }).template.metadata;
    expect(tpl.legacyAppArmorProfiles).toEqual([
      { container: "web", valid: true },
      { container: "invalid", valid: false },
    ]);
  });

  test.each([
    ["runtime/default", true],
    ["localhost/PRIVATE_PROFILE_SENTINEL", true],
    ["unconfined", false],
    ["localhost-unconfined", false],
    [null, true],
    [42, false],
  ])("projects AppArmor value %s to validity without retaining it", (value, valid) => {
    const projected = runFilter(JSON.stringify({
      kind: "List",
      items: [{
        kind: "Pod",
        metadata: {
          name: "apparmor-case",
          annotations: {
            "container.apparmor.security.beta.kubernetes.io/app": value,
          },
        },
        spec: { containers: [{ name: "app", image: "example:v1" }] },
      }],
    }));
    expect(projected.items[0].metadata.legacyAppArmorProfiles).toEqual([{ container: "app", valid }]);
    expect(projected.raw).not.toContain("PRIVATE_PROFILE_SENTINEL");
  });

  test.each([
    [{}, false, false],
    [{ user: null, role: null }, false, false],
    [{ user: "", role: "" }, false, false],
    [{ user: "SELINUX_USER_SENTINEL" }, true, false],
    [{ role: "SELINUX_ROLE_SENTINEL" }, false, true],
    [{ user: "SELINUX_USER_SENTINEL", role: "SELINUX_ROLE_SENTINEL" }, true, true],
  ])("preserves SELinux rule evidence without retaining raw user/role %j", (values, userConfigured, roleConfigured) => {
    const seLinuxOptions = { type: "container_t", ...values };
    const projected = runFilter(JSON.stringify({
      kind: "List",
      items: [{
        kind: "Pod",
        metadata: { name: "selinux-case" },
        spec: {
          securityContext: { seLinuxOptions },
          containers: [{ name: "app", image: "example:v1", securityContext: { seLinuxOptions } }],
        },
      }],
    }));
    const spec = projected.items[0].spec as {
      securityContext: { seLinuxOptions: unknown };
      containers: { securityContext: { seLinuxOptions: unknown } }[];
    };
    const expected = { type: "container_t", userConfigured, roleConfigured };
    expect(spec.securityContext.seLinuxOptions).toEqual(expected);
    expect(spec.containers[0].securityContext.seLinuxOptions).toEqual(expected);
    expect(projected.raw).not.toContain("SELINUX_USER_SENTINEL");
    expect(projected.raw).not.toContain("SELINUX_ROLE_SENTINEL");
  });

  test("computes duplicate Service selectors per namespace and keeps StorageClass provisioner", () => {
    for (const svc of byKind("Service")) {
      expect(svc.selectorDuplicateCount).toBe(2);
    }
    expect(byKind("StorageClass")[0].provisioner).toBe("kubernetes.io/azure-disk");
  });
});
