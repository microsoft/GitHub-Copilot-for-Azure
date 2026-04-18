# AKS Deployment Safeguards Reference

> **Last updated:** 2026-04-02

AKS Deployment Safeguards enforce best practices on Kubernetes manifests at admission time. This reference covers every rule the skill validates **before** deployment.

---

## DS001 — Resource Limits Required (Error)

Every container needs `resources.requests` AND `resources.limits` for both `cpu` and `memory`.

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
```

## DS002 — Liveness Probe Required (Warning)

Every container needs a `livenessProbe`. Use `httpGet`, `tcpSocket`, or `exec`:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 15
```

## DS003 — Readiness Probe Required (Warning)

Every container needs a `readinessProbe`:

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
```

## DS004 — runAsNonRoot Required (Error)

Set at **both** pod and container level:

```yaml
# Pod level
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000

# Container level
securityContext:
  runAsNonRoot: true
```

## DS005 — No hostNetwork (Error)

Remove `hostNetwork: true` or set to `false`.

## DS006 — No hostPID (Error)

Remove `hostPID: true` or set to `false`.

## DS007 — No hostIPC (Error)

Remove `hostIPC: true` or set to `false`.

## DS008 — No Privileged Containers (Error)

Remove `securityContext.privileged: true` or set to `false`.

## DS009 — No :latest Image Tag (Error, NOT auto-fixable)

Use a semantic version, git SHA, or digest — never `:latest` or omit the tag.

## DS010 — Minimum 2 Replicas (Warning)

Set `spec.replicas: 2` or higher. Pair with a PodDisruptionBudget.

## DS011 — allowPrivilegeEscalation: false (Error)

Every container must have:

```yaml
securityContext:
  allowPrivilegeEscalation: false
```

## DS012 — readOnlyRootFilesystem: true (Warning)

```yaml
securityContext:
  readOnlyRootFilesystem: true
```

If the app writes to specific paths, mount `emptyDir` volumes:

```yaml
volumes:
  - name: tmp
    emptyDir: {}
containers:
  - volumeMounts:
      - name: tmp
        mountPath: /tmp
```

Common writable paths: Spring Boot `/tmp`, ASP.NET `/tmp`, Django `/tmp`, Express `/tmp`, Go `/tmp`.

## DS013 — automountServiceAccountToken: false (Warning)

```yaml
spec:
  automountServiceAccountToken: false
```

Set to `true` only if the app genuinely calls the K8s API (scope with RBAC).

---

## Quick Reference

| Rule | What | Severity | Auto-Fix |
|------|------|----------|----------|
| DS001 | Resource limits | Error | Yes |
| DS002 | Liveness probe | Warning | Yes |
| DS003 | Readiness probe | Warning | Yes |
| DS004 | runAsNonRoot | Error | Yes |
| DS005 | No hostNetwork | Error | Yes |
| DS006 | No hostPID | Error | Yes |
| DS007 | No hostIPC | Error | Yes |
| DS008 | No privileged | Error | Yes |
| DS009 | No :latest tag | Error | No |
| DS010 | Min 2 replicas | Warning | Yes |
| DS011 | No privilege escalation | Error | Yes |
| DS012 | Read-only root FS | Warning | Yes |
| DS013 | No SA token mount | Warning | Yes |
