# Python AI Service Dockerfile
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Development stage
FROM base AS development

# Copy requirements
COPY requirements.txt .
COPY requirements-dev.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-dev.txt

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/models /app/data /app/logs

# Expose port
EXPOSE 5000

# Start development server
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000", "--debug"]

# Production stage
FROM base AS production

# Create non-root user
RUN groupadd --gid 1001 python && \
    useradd --uid 1001 --gid python --shell /bin/bash --create-home python

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=python:python . .

# Create necessary directories
RUN mkdir -p /app/models /app/data /app/logs && \
    chown -R python:python /app

# Switch to non-root user
USER python

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start production server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app:app"]