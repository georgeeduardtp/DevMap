FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DEVMAP_STANDALONE=1
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --no-fund --no-audit
COPY scripts/next.mjs ./scripts/next.mjs
COPY frontend ./frontend
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
