# Spring Boot Knowledge Pack

> **Applies to:** Projects detected with `pom.xml` containing `spring-boot-starter-web` or `build.gradle`/`build.gradle.kts` containing `org.springframework.boot`

---

## Dockerfile Patterns

### Multi-stage build with layered JAR extraction

Spring Boot 2.3+ supports layered JARs for optimized Docker layer caching:

```dockerfile
# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline -B
COPY src src
RUN ./mvnw package -DskipTests -B

# Extract layers for caching
FROM eclipse-temurin:21-jdk-alpine AS extract
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Runtime stage
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=extract /app/dependencies/ ./
COPY --from=extract /app/spring-boot-loader/ ./
COPY --from=extract /app/snapshot-dependencies/ ./
COPY --from=extract /app/application/ ./
USER spring:spring
EXPOSE 8080
# HEALTHCHECK is omitted — Kubernetes liveness/readiness probes handle
# health checks in AKS. See deployment.yaml for probe configuration.
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.LaunchedClassPathJarLauncher"]
```

### Key points

- **Base image:** Eclipse Temurin (Adoptium) is the recommended OpenJDK distribution for production
- **Alpine variant** reduces image size by ~60% compared to Debian-based
- **Layered JAR extraction** means only changed layers are rebuilt/pushed — dependencies rarely change
- **Non-root user** (`spring`) satisfies DS004

### ACR-compatible flattening

If the layered extraction fails (older Spring Boot versions), flatten the layers:

```dockerfile
COPY --from=extract /app/dependencies/ ./
COPY --from=extract /app/spring-boot-loader/ ./
COPY --from=extract /app/snapshot-dependencies/ ./
COPY --from=extract /app/application/ ./
```

This is compatible with ACR's layer deduplication.

---

## Health Endpoints

Spring Boot Actuator provides health endpoints out of the box:

| Endpoint | Purpose | Probe Type |
|----------|---------|-----------|
| `/actuator/health` | Overall health | General |
| `/actuator/health/liveness` | Liveness group | `livenessProbe` |
| `/actuator/health/readiness` | Readiness group | `readinessProbe` |

### Required configuration

In `application.properties` or `application.yml`:

```properties
management.endpoints.web.exposure.include=health
management.endpoint.health.probes.enabled=true
management.endpoint.health.show-details=always
```

The probes are automatically enabled when running in Kubernetes (detected via the `KUBERNETES_SERVICE_HOST` env var), but it's best practice to enable them explicitly.

### Probe configuration in Deployment manifest

```yaml
startupProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  periodSeconds: 10
  failureThreshold: 30        # allows up to 300s for JVM warmup + Spring context init
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

**Important:** Spring Boot apps need a `startupProbe` because JVM warmup and Spring context initialization typically take 15-60 seconds. Without it, the liveness probe may kill the pod before it finishes starting. The startup probe gives the app up to 300 seconds to become healthy before the liveness probe takes over. Uncomment the `startupProbe` section in the deployment template.

---

## Database Profiles

Spring Boot uses Spring Profiles to switch database configurations:

| Profile | Activation | Typical Config File |
|---------|------------|-------------------|
| `default` | No profile set | `application.properties` — usually H2 in-memory |
| `mysql` | `SPRING_PROFILES_ACTIVE=mysql` | `application-mysql.properties` |
| `postgres` | `SPRING_PROFILES_ACTIVE=postgres` | `application-postgres.properties` |

### Environment variables for PostgreSQL on AKS

```yaml
env:
  - name: SPRING_PROFILES_ACTIVE
    value: postgres
  - name: POSTGRES_URL
    value: "jdbc:postgresql://{{PG_SERVER_NAME}}.postgres.database.azure.com:5432/{{DB_NAME}}"
  - name: POSTGRES_USER
    value: "{{IDENTITY_NAME}}"
  - name: SPRING_DATASOURCE_AZURE_PASSWORDLESS_ENABLED
    value: "true"
```

With Workload Identity and the `spring-cloud-azure-starter-jdbc-postgresql` dependency, Spring Boot can authenticate to PostgreSQL without a password using Azure AD tokens.

### ConfigMap pattern

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{APP_NAME}}-config
data:
  SPRING_PROFILES_ACTIVE: "postgres"
  MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE: "health"
  MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED: "true"
```

---

## Writable Paths (DS012 Compliance)

When `readOnlyRootFilesystem: true` is set, Spring Boot needs `/tmp` writable:

- **Tomcat** writes session data and compiled JSPs to `/tmp`
- **Multipart file uploads** use `/tmp` as the staging directory
- **Spring Boot DevTools** (if accidentally included) writes to `/tmp`

### Required volume mount

```yaml
volumes:
  - name: tmp
    emptyDir: {}
containers:
  - name: app
    volumeMounts:
      - name: tmp
        mountPath: /tmp
```

No other writable paths are typically needed for production Spring Boot apps.

---

## Resource Sizing

Spring Boot apps running on the JVM need more memory than interpreted languages. These are starting-point defaults — tune based on observed usage.

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 250m | 1000m |
| Memory | 512Mi | 1Gi |

Set `-XX:MaxRAMPercentage=75.0` in `JAVA_OPTS` so the JVM uses at most 75% of the container's memory limit, leaving headroom for the OS and non-heap memory.

---

## Port Configuration

- **Default port:** 8080
- **Config property:** `server.port` in `application.properties`
- **Env var override:** `SERVER_PORT=8080`

Spring Boot always logs the port on startup: `Tomcat started on port(s): 8080 (http)`

---

## Build Commands

| Build Tool | Build Command | Output |
|-----------|---------------|--------|
| Maven | `./mvnw package -DskipTests -B` | `target/*.jar` |
| Gradle | `./gradlew bootJar` | `build/libs/*.jar` |

The `-B` flag (batch mode) suppresses interactive Maven output — important for CI/CD and Docker builds.

---

## Common Issues on AKS

| Issue | Symptom | Fix |
|-------|---------|-----|
| JVM OOM in container | `OOMKilled` pod status | Set `-XX:MaxRAMPercentage=75.0` in `JAVA_OPTS` and ensure memory limit >= 256Mi |
| Slow startup | Readiness probe fails, pod restarted | Increase `initialDelaySeconds` to 45-60s, or add a `startupProbe` with higher `failureThreshold` |
| H2 in-memory on AKS | Data lost on pod restart | Switch to PostgreSQL profile — H2 is for local dev only |
| Connection refused to PostgreSQL | `PSQLException: Connection refused` | Verify firewall rules on PostgreSQL Flexible Server allow AKS subnet |
| Image too large (>500MB) | Slow pulls, high ACR storage | Use Alpine base image + layered JAR extraction |
