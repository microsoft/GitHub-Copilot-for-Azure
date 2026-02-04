# Use official Python runtime as base image
# Using Python 3.11 on Debian-based image (not Alpine) because GitHub CLI binaries need glibc
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install GitHub CLI, Azure CLI, and dependencies
# Install GitHub CLI, Azure CLI, and dependencies
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    # Install GitHub CLI
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    # Install Azure CLI
    && curl -sL https://aka.ms/InstallAzureCLIDeb | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN curl -fsSL https://gh.io/copilot-install | bash

# Copy application files
COPY main.py .

# Copy skills directory (create empty if doesn't exist locally)
COPY skills/ ./skills/

# Expose port (Azure AI Agent Server default port)
EXPOSE 8088

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Create directory for GitHub CLI config
RUN mkdir -p /root/.config/gh

# Run the Azure AI Agent Server
CMD ["python", "main.py"]
