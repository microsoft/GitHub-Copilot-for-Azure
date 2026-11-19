# Java

- [Detect the build tool, Java version, module, server, and artifact](detect.md). Discover matching Linux runtimes with `az webapp list-runtimes --os linux -o json`, selecting Java SE for a runnable JAR, Tomcat for a compatible WAR, or JBoss EAP for a compatible WAR/EAR.
- [Use platform startup](startup-commands.md); preserve platform port binding and configure a custom startup only when required.
- CLI: run the existing Maven/Gradle wrapper where present (`./mvnw package` / `.\mvnw.cmd package`, `./gradlew build` / `.\gradlew.bat build`), or the matching installed tool. Require a successful local build with the compatible JDK, and select the fresh deployable artifact from that module, not sources, test, or plain non-runnable JARs. Upload with `--type jar`, `war`, or `ear`; don't ZIP source or enable Oryx.
- azd: verify `language: java`, deployable module path and local JDK. Let azd build the artifact. If azd doesn't support the project's build, stop rather than converting the project.
