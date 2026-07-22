FROM python:3.12-slim

ENV HOME=/home/agent \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ADK_SESSION_DB=sqlite+aiosqlite:////data/sessions.sqlite

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 agent \
    && mkdir /data \
    && chown agent:agent /data
COPY main.py .
COPY customer_support_agent ./customer_support_agent

USER agent
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
