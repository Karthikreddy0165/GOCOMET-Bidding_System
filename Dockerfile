# Multi-stage Dockerfile for Railway and Cloud Deployment

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python 3.11 Backend & Unified Production Server
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into /app/static
COPY --from=frontend-builder /app/frontend/dist /app/static

WORKDIR /app/backend
ENV PYTHONPATH=/app/backend
ENV STATIC_DIR=/app/static
ENV PORT=8080

EXPOSE 8080

# Seed demo data and launch uvicorn
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

