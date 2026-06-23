FROM python:3.12-slim

# git is required to install agent_kit from GitHub
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
# uv sync resolves and installs deps (including git dep)
RUN uv sync --no-dev

COPY src/ src/
COPY config.yaml .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "health_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
