FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git gnupg jq libicu-dev python3 unzip zip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://aka.ms/InstallAzureCLIDeb -o /tmp/install-azure-cli.sh \
    && bash /tmp/install-azure-cli.sh \
    && rm /tmp/install-azure-cli.sh

RUN curl -fsSL https://aka.ms/install-azd.sh -o /tmp/install-azd.sh \
    && bash /tmp/install-azd.sh \
    && rm /tmp/install-azd.sh \
    && azd config set auth.useAzCliAuth true

RUN npm install --global azure-functions-core-tools@4 \
    && npm cache clean --force

WORKDIR /app
CMD ["sleep", "infinity"]
