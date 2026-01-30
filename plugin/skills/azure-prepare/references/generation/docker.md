# Docker Configuration Generation

Generate optimized Dockerfiles for containerizable services.

## TASK

Create production-ready Dockerfiles for services that will be deployed as containers.

## Containerization Candidates

### Include

- ✅ Microservices
- ✅ REST/GraphQL APIs
- ✅ Web applications (server-rendered)
- ✅ Background workers
- ✅ Message processors

### Exclude

- ❌ Static websites (use Static Web Apps)
- ❌ Azure Functions (use native deployment)
- ❌ Database services
- ❌ Logic Apps

## Dockerfile Requirements

### Multi-stage Builds

Separate build and runtime stages:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Minimal Base Images

| Language | Base Image |
|----------|-----------|
| Node.js | `node:18-alpine` or `node:20-alpine` |
| Python | `python:3.11-slim` |
| .NET | `mcr.microsoft.com/dotnet/aspnet:8.0-alpine` |
| Java | `eclipse-temurin:17-jre-alpine` |
| Go | `scratch` or `alpine:3.18` |

### Non-root Users

```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

USER appuser
```

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

## Language-Specific Templates

### Node.js

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build (if needed)
RUN npm run build --if-present

# Runtime
FROM node:18-alpine
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nodejs -G nodejs

COPY --from=builder --chown=nodejs:nodejs /app .

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
```

### Python

```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime
FROM python:3.11-slim
WORKDIR /app

RUN useradd -m -u 1001 appuser

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### .NET

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app

RUN addgroup -g 1001 -S dotnet && \
    adduser -u 1001 -S dotnet -G dotnet

COPY --from=builder --chown=dotnet:dotnet /app/out .

USER dotnet
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Api.dll"]
```

### Java (Spring Boot)

```dockerfile
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline

COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -g 1001 -S java && \
    adduser -u 1001 -S java -G java

COPY --from=builder --chown=java:java /app/target/*.jar app.jar

USER java
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
```

## .dockerignore Template

```
node_modules
.git
.gitignore
.env
.env.*
*.md
Dockerfile*
docker-compose*
.dockerignore
.vscode
.idea
coverage
dist
__pycache__
*.pyc
.pytest_cache
bin
obj
```

## Checklist Format

Document in Preparation Manifest:

```markdown
## Docker File Checklist

| Service | Dockerfile Path | Base Image | Port | Status |
|---------|-----------------|------------|------|--------|
| user-api | src/user-api/Dockerfile | node:18-alpine | 3000 | ✅ Generated |
| order-worker | src/worker/Dockerfile | python:3.11-slim | 8000 | ✅ Generated |
| web-frontend | N/A | N/A | N/A | ⏭️ Static Web App |
```
