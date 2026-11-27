FROM mcr.microsoft.com/azurelinux/base/python:3.12

ENV HOME=/home/agent \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN tdnf install -y shadow-utils \
    && tdnf clean all \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 agent
COPY main.py mcp_server.py ./
COPY customer_support_agent ./customer_support_agent

USER agent
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
