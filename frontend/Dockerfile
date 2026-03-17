# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Declare build-time args — VITE_* vars are baked into the JS bundle at build time
ARG VITE_WLD_APP_ID=app_ac9f43a974959b04b11b081c3740f932
ARG VITE_BACKEND_URL=/api

# Make args available to the Vite build
ENV VITE_WLD_APP_ID=$VITE_WLD_APP_ID \
  VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Production — serve with nginx ────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config (handles SPA routing + API proxy to backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
