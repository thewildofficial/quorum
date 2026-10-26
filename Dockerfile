# Single-image build: client bundle + API server + embedded SQLite.
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
# better-sqlite3 needs build tools only if no prebuilt binary matches
RUN apk add --no-cache python3 make g++ && npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules server/node_modules
COPY server/ server/
COPY --from=client-build /app/client/dist client/dist
COPY package.json ./
RUN mkdir -p /app/data
ENV PORT=4000 DATABASE_PATH=/app/data/deliberate.db
EXPOSE 4000
# Optional: seed the demo account on first run with SEED=1 docker run -e SEED=1 ...
CMD ["sh", "-c", "if [ \"$SEED\" = \"1\" ]; then node server/src/seed.js; fi; node server/src/index.js"]
