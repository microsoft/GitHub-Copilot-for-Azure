# Local Preview Guide

Test your application locally before deploying to Azure. No Azure authentication required.

---

## ⚠️ Important: Recommended Local Preview Methods

**For best reliability, use framework-native preview tools over SWA CLI for simple static site testing.**

| Method | Use When | Reliability |
|--------|----------|-------------|
| `npm run preview` | Vite/React/Vue SPAs | ✅ Most reliable |
| `npx serve dist` | Any static build output | ✅ Very reliable |
| `python3 -m http.server` | Quick testing, no npm needed | ✅ Reliable |
| `swa start` | Need API integration or auth mocking | ⚠️ May have session issues |

### Quick Start (Recommended)

```bash
# For Vite projects (React, Vue, etc.)
npm run build
npm run preview -- --host

# For any static site (universal fallback)
npm run build
npx serve dist

# Simplest option (Python, no deps)
cd dist && python3 -m http.server 8080
```

---

## Known Issues & Troubleshooting

### SWA CLI Session Termination (macOS)

**Problem:** SWA CLI starts successfully but the process terminates unexpectedly, especially when run from automated tools or certain terminal environments.

**Symptoms:**
- SWA CLI shows "Azure Static Web Apps emulator started" then dies
- `curl http://localhost:4280` returns "Connection refused"
- Session becomes invalid

**Workarounds:**
1. **Use `npm run preview` instead** (most reliable for Vite projects)
2. **Use `npx serve dist`** (works for any static build)
3. **Run SWA CLI in a separate terminal window** (not through automation)
4. **For API testing, deploy to Azure** and test the deployed version

**Root Cause:** Process isolation utilities like `setsid` (Linux) are not available on macOS by default, causing issues with background process management.

### SWA CLI Alternatives by Use Case

| Need | Solution |
|------|----------|
| Just test static files | `npx serve dist` or `npm run preview` |
| Test with routing rules | Deploy to Azure (routing only works there) |
| Test with mock auth | Must use SWA CLI in foreground terminal |
| Test with API backend | Use SWA CLI in foreground, or deploy to Azure |

---

## Quick Test

Run the included test script to verify all local dev servers work:

```bash
./test-local.sh
```

This tests 7 scenarios:
- Static HTML with Python HTTP server (port 8080)
- React/Vite with `npm run dev` (port 5173)
- Python Flask with `flask run` (port 5000)
- Azure Functions with `func start` (port 7071)
- Static HTML with SWA CLI (port 4280)
- Next.js SSR with `npm run dev` (port 3000)
- Monorepo with parallel API + Frontend servers (ports 3001, 3000)

---

## Quick Reference

| Service Target | Local Tool | Command | Default Port |
|----------------|------------|---------|--------------|
| Static Web Apps | **npm run preview** (recommended) | `npm run preview` | 4173 |
| Static Web Apps | npx serve | `npx serve dist` | 3000 |
| Static Web Apps | SWA CLI | `swa start` | 4280 |
| Azure Functions | Functions Core Tools | `func start` | 7071 |
| App Service (Node) | npm | `npm run dev` | varies |
| App Service (Python) | Flask | `flask run` | 5000 |
| App Service (.NET) | dotnet | `dotnet run` | 5000 |

---

## Install Local Development Tools

```bash
# Install all tools at once (npm-based)
npm install -g @azure/static-web-apps-cli azure-functions-core-tools@4

# Verify installations
swa --version
func --version
```

---

## Static Web Apps Local Development

### Method 1: Framework Preview (Recommended)

For Vite-based projects (React, Vue, Svelte, etc.):

```bash
# Build first
npm run build

# Preview production build
npm run preview

# With network access (for testing on other devices)
npm run preview -- --host
```

### Method 2: Simple Static Server

For any static site:

```bash
# Using npx (no global install needed)
npx serve dist

# Using Python (no npm needed)
cd dist && python3 -m http.server 8080
```

### Method 3: SWA CLI (When API/Auth Needed)

> ⚠️ May have session issues on macOS. Use in a dedicated terminal window.

```bash
# Auto-detect and start
swa start

# Specify output directory
swa start ./dist

# With API folder
swa start ./dist --api-location ./api
```

### With Framework Dev Server

For hot-reload during development:

```bash
# Start your dev server first (in another terminal)
npm run dev  # Runs on http://localhost:3000

# Then proxy through SWA CLI
swa start http://localhost:3000 --api-location ./api
```

### Configuration File

Create `swa-cli.config.json` for persistent settings:

```json
{
  "configurations": {
    "app": {
      "outputLocation": "./dist",
      "apiLocation": "./api",
      "devServerCommand": "npm run dev",
      "devServerUrl": "http://localhost:3000"
    }
  }
}
```

Then just run:
```bash
swa start
```

### Mock Authentication

SWA CLI provides mock auth for testing:

```bash
# Access mock login
http://localhost:4280/.auth/login/github

# Mock user appears as authenticated
# Customize via /.auth/login/<provider>?post_login_redirect_uri=/
```

---

## Azure Functions Local Development

### Basic Usage

```bash
# Start Functions runtime
func start

# Custom port
func start --port 7072

# Enable CORS
func start --cors "*"

# Verbose output
func start --verbose
```

### Local Settings

Create `local.settings.json` (gitignored by default):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

### With Azurite (Local Storage Emulator)

```bash
# Install Azurite
npm install -g azurite

# Start storage emulator
azurite --silent --location ./azurite --debug ./azurite/debug.log

# In another terminal, start Functions
func start
```

### Debugging

**VS Code:** Use built-in debugging with F5 (launch.json auto-generated).

**Node.js manual:**
```bash
func start --language-worker -- --inspect=9229
```

---

## App Service Local Development

Use your framework's native development server.

### Node.js

```bash
# Express/Fastify/etc.
npm run dev
# or
npm start
# or
node server.js
```

### Python

```bash
# Flask
flask run --debug

# FastAPI
uvicorn main:app --reload --port 8000

# Django
python manage.py runserver
```

### .NET

```bash
# Watch mode (auto-reload)
dotnet watch run

# Standard run
dotnet run
```

### Java Spring Boot

```bash
./mvnw spring-boot:run
# or
./gradlew bootRun
```

---

## Full-Stack Local Development

### SWA + Managed Functions

```bash
# Project structure
project/
├── src/           # Frontend source
├── dist/          # Frontend build output
├── api/           # Functions API
│   ├── host.json
│   └── function1/

# Terminal 1: Build and watch frontend
npm run dev

# Terminal 2: Start SWA with API
swa start http://localhost:3000 --api-location ./api
```

### Separate Frontend + Backend

```bash
# Terminal 1: Backend API (e.g., Express on :3001)
cd backend && npm run dev

# Terminal 2: Frontend (e.g., React on :3000)
cd frontend && npm run dev

# Configure frontend to proxy API calls
# vite.config.js or setupProxy.js
```

**Vite proxy example:**
```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
}
```

---

## Environment Variables

### Local .env Files

```bash
# .env.local (gitignored)
API_URL=http://localhost:7071/api
DATABASE_URL=mongodb://localhost:27017/dev
```

### Framework Support

| Framework | File | Access |
|-----------|------|--------|
| Vite | `.env.local` | `import.meta.env.VITE_*` |
| Create React App | `.env.local` | `process.env.REACT_APP_*` |
| Next.js | `.env.local` | `process.env.NEXT_PUBLIC_*` |
| Vue CLI | `.env.local` | `process.env.VUE_APP_*` |
| Angular | `environment.ts` | Import directly |

---

## Docker-Based Local Development

### With Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    
  api:
    build: ./api
    ports:
      - "7071:7071"
    environment:
      - AzureWebJobsStorage=UseDevelopmentStorage=true
    
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports:
      - "10000:10000"
      - "10001:10001"
      - "10002:10002"
```

```bash
docker-compose up
```

---

## Database Emulators

### Cosmos DB Emulator

```bash
# Docker
docker run -p 8081:8081 -p 10251-10254:10251-10254 \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

# Connection string
AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
```

### SQL Server

```bash
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
```

### Redis

```bash
docker run -p 6379:6379 redis:alpine
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### SWA CLI Issues

**Session terminates unexpectedly (common on macOS):**
```bash
# Best solution: Use alternative preview methods
npm run preview  # For Vite projects
npx serve dist   # For any static build

# If you must use SWA CLI, run in foreground terminal (not background)
swa start ./dist  # Keep terminal open
```

**Clear SWA CLI cache:**
```bash
rm -rf ~/.swa

# Run with debug output
SWA_CLI_DEBUG=* swa start
```

**setsid error on macOS:**
```
bash: setsid: command not found
```
This is expected - `setsid` is a Linux command. Use SWA CLI in foreground mode or use alternative preview methods.

### Functions Core Tools Issues

```bash
# Clear Functions cache
rm -rf ~/.azure-functions-core-tools

# Check Node version (Functions v4 requires Node 18+, recommend 22 LTS)
node --version

# Reinstall Functions tools
npm uninstall -g azure-functions-core-tools
npm install -g azure-functions-core-tools@4
```

### CORS Errors

Local development often requires CORS configuration:

```bash
# Functions: local.settings.json
{
  "Host": { "CORS": "*" }
}

# Or start with flag
func start --cors "*"
```

### Vite Preview Not Working

```bash
# Ensure you built first
npm run build

# Check dist folder exists
ls -la dist/

# If missing build script, use serve instead
npx serve dist
```

---

## OS-Specific Notes

### macOS

- **SWA CLI:** May have session persistence issues. Prefer `npm run preview` or `npx serve`.
- **Process management:** `setsid` not available; use foreground processes for dev servers.
- **Homebrew users:** Ensure Node.js 22 LTS is installed via `brew install node@22`.

### Linux

- **SWA CLI:** Generally works well with background processes.
- **Permissions:** May need `sudo` for global npm installs, or use `nvm` to avoid.

### Windows

- **Terminal:** Use PowerShell or Windows Terminal for best compatibility.
- **Paths:** Use forward slashes in commands or quote paths with backslashes.
- **WSL:** For most reliable experience, run in WSL2 with Linux instructions.
