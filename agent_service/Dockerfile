FROM python:3.13-slim

# git is required to install agent_kit from GitHub; curl is required for healthcheck
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
# uv sync installs deps from the lockfile for a reproducible build
RUN uv sync --frozen --no-dev

COPY src/ src/
COPY config.yaml .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "health_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
