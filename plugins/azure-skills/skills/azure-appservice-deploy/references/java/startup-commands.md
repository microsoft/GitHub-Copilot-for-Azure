# Startup Commands by Framework

## Default: no startup override

App Service starts the deployed artifact automatically:

| Server | Behavior |
|---|---|
| Java SE | Runs `/home/site/wwwroot/app.jar` (OneDeploy renames the JAR) |
| Tomcat | Serves `app.war` at the root path |
| JBoss EAP | Deploys `app.war`/EAR; EAR context root comes from `application.xml` (use `<context-root>/</context-root>` for root) |

Do not add `java -jar` startup commands, `mvn spring-boot:run`, or scripts unnecessarily. If reusing an app with a stale custom command, explain it and clear it:

```bash
az webapp config set -n <app> -g <rg> --startup-file ""
```

```powershell
az webapp config set -n <app> -g <rg> --startup-file ""
```

A custom script, **only when needed** (e.g., JBoss EAP CLI configuration), is uploaded with `az webapp deploy --type startup --src-path startup.sh` after [LF normalization](../normalize-scripts.md).

## Port binding (Java SE)

The platform routes traffic to port 80 and sets `PORT=80`, `SERVER_PORT=80` and `-Dserver.port=80`. Spring Boot binds automatically. For other frameworks read `PORT` (e.g., Quarkus `quarkus.http.port=${PORT:8080}`, Micronaut `micronaut.server.port=${PORT:8080}`). Do not hard-code a port or bind to `localhost`; with the user's knowledge, replace hard-coded values so the app listens on all interfaces. Tomcat/JBoss EAP manage ports themselves.

## JVM and production settings

- JVM options: app setting `JAVA_OPTS` (Java SE, JBoss EAP) or `CATALINA_OPTS` (Tomcat), e.g., `-Xmx` sized to the plan. Avoid overriding platform-provided options without reason.
- Spring profiles: `SPRING_PROFILES_ACTIVE`; keep production defaults unless the user requests otherwise.
- App settings become environment variables; Spring Boot relaxed binding maps `SPRING_DATASOURCE_URL` → `spring.datasource.url`.
- Never print secrets or ship credentials/keystores inside the artifact. Use app settings for required existing secrets; additional Azure services are a handoff to `azure-prepare`.
- HTTPS terminates at the platform proxy. For redirect loops, honor forwarded headers (Spring: `server.forward-headers-strategy=framework`) rather than disabling HTTPS.
- WebSockets (STOMP, etc.) require enabling web sockets: `az webapp config set -n <app> -g <rg> --web-sockets-enabled true`.

## Diagnosing a wrong startup command

Use these commands only after a failure or when the user requests troubleshooting.

```bash
# Current value
az webapp config show -n <app> -g <rg> --query linuxFxVersion -o tsv
az webapp config show -n <app> -g <rg> --query appCommandLine -o tsv
```

Look for a stale startup command, a mismatched runtime/server, or an app bound to localhost. See [errors.md](../errors.md) for fixes.
