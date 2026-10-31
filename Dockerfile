FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-trixie-slim
ENV NODE_ENV=production
ENV BACKUPS_DIR=/data/backups
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 gosu && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/migrations apps/api/migrations
COPY --from=build /app/apps/web/dist apps/web/dist
COPY scripts/docker-entrypoint.sh /usr/local/bin/day-planner-entrypoint
ENTRYPOINT ["sh", "/usr/local/bin/day-planner-entrypoint"]
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
