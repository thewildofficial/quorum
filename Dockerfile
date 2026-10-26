# Single-image build: client bundle + API server. Data lives in Postgres (DATABASE_URL).
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules server/node_modules
COPY server/ server/
COPY --from=client-build /app/client/dist client/dist
COPY package.json ./
# Required at runtime: DATABASE_URL (Postgres connection string)
ENV PORT=4000
EXPOSE 4000
# Optional: seed the demo account on first run with SEED=1 docker run -e SEED=1 ...
CMD ["sh", "-c", "if [ \"$SEED\" = \"1\" ]; then node server/src/seed.js; fi; node server/src/index.js"]
