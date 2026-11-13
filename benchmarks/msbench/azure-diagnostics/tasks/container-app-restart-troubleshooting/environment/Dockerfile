FROM ubuntu:24.04

USER root
RUN command -v apt-get >/dev/null 2>&1 || { echo "harbor-exporter: base image must provide apt-get (Debian/Ubuntu). Pass installRuntime=false if your image already has Node.js + vally-cli."; exit 1; } && \
    apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    if ! command -v node >/dev/null 2>&1 || \
       ! command -v npm >/dev/null 2>&1 || \
       ! node -e 'const current = process.versions.node.split(".").map(Number); const minimum = [22,15,0]; const differingPart = current.findIndex((part, index) => part !== minimum[index]); process.exit(differingPart === -1 || current[differingPart] > minimum[differingPart] ? 0 : 1);'; then \
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
        apt-get install -y --no-install-recommends nodejs; \
    fi && \
    npm install -g --include=optional @microsoft/vally-cli@0.21.0 && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ["skills/azure-diagnostics/", "/app/.agents/skills/azure-diagnostics/"]
COPY ["skills/azure-diagnostics/", "/app/.claude/skills/azure-diagnostics/"]
ENTRYPOINT []
