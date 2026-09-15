# Java Dockerfile

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre AS runtime
RUN useradd --create-home app
WORKDIR /app
COPY --from=build --chown=app:app /src/target/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Use Gradle equivalents when the project has `build.gradle`. Align the application server
port and Container App `targetPort` with `8080`.
