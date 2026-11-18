FROM node:22-alpine AS ui
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY public ./public
COPY index.html vite.config.js ./
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 CAUSALYTIX_DATA=/app/.data
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 causalytix && mkdir -p /app/.data && chown causalytix:causalytix /app/.data
COPY --from=ui /app/dist ./dist
COPY backend ./backend
USER causalytix
VOLUME ["/app/.data"]
EXPOSE 5173
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "5173"]
