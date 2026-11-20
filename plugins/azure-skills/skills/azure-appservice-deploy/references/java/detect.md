# Framework Detection

Inspect source before choosing a runtime. Do not modify Java versions, packaging or imports to make deployment fit.

## What to check

### Build tool

| Indicator | Build command (from project root) |
|---|---|
| `mvnw` / `mvnw.cmd` | `./mvnw clean package` (PowerShell: `.\mvnw.cmd clean package`) |
| `pom.xml` only | `mvn clean package` |
| `gradlew` / `gradlew.bat` | `./gradlew clean build` (PowerShell: `.\gradlew.bat clean build`) |
| `build.gradle(.kts)` only | `gradle clean build` |

Prefer the wrapper. Run the normal package/build including tests; if tests fail, report the failure and ask before skipping tests (`-DskipTests` / `-x test`). Multi-module builds: identify the deployable module (the one producing the web JAR/WAR/EAR); ask if more than one qualifies.

## Outcomes

### Server and artifact

| Indicator | Server | `--type` |
|---|---|---|
| Spring Boot plugin, `packaging` jar (default), Quarkus `uber-jar`, Micronaut/Dropwizard/Javalin fat JAR | Java SE | `jar` |
| `<packaging>war</packaging>` / Gradle `war` plugin, no JBoss/EAR or full-server requirements | Tomcat | `war` |
| `<packaging>ear</packaging>`, EAR `application.xml`, `jboss-web.xml`, `jboss-deployment-structure.xml`, or EJB requiring a full server | JBoss EAP | `war` / `ear` |
| Spring Boot WAR (`SpringBootServletInitializer`) | Tomcat | `war` |
| Azure Functions (`azure-functions-maven-plugin`), Azure Spring Apps, Dockerfile-only | Hand off to `azure-prepare` | — |
| Library/CLI, no HTTP entry point | Explain missing web entry; do not pretend it is a web app | — |

Honor an explicit user choice of server. A full Jakarta EE API dependency alone does not establish a JBoss requirement; inspect the APIs actually used and ask when the required server is unclear. Quarkus defaults to `fast-jar` (a directory, not a single JAR): build with `-Dquarkus.package.jar.type=uber-jar` only with the user's knowledge, or hand off.

## Java version and server generation

- Read `maven.compiler.release` / `<java.version>` / `maven.compiler.target`, Gradle `toolchain.languageVersion` / `sourceCompatibility`. Choose the runtime with the same Java major (8 → `jre8`, 11/17/21/25 → `javaNN`).
- The local JDK must be ≥ the target release. If not, report it; never lower the release.
- `jakarta.*` imports (Spring Boot 3+, Jakarta EE 9+) → Tomcat 10.1/11 or JBoss EAP 8. `javax.*` servlet/EE imports → Tomcat 9.0 or JBoss EAP 7. Mismatches cause 404s or `ClassNotFoundException`.

## Locate the artifact after building

| Build | Typical path |
|---|---|
| Maven | `target/<artifactId>-<version>.jar|war|ear` |
| Gradle | `build/libs/<name>-<version>.jar|war` |

Select exactly one file. Exclude `*-plain.jar`, `*.jar.original`, `*-sources.jar`, `*-javadoc.jar` and `*-tests.jar`. If several remain, ask which to deploy. Verify the file timestamp is from this build.

## Example output to surface to the user

```text
Detected: Spring Boot (Java 21)
Build: Maven wrapper; executable JAR
Runtime: JAVA:21-java21; startup is automatic.
```
