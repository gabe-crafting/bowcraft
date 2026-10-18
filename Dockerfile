FROM oven/bun:1.3.7
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN bun install --frozen-lockfile

COPY shared shared
COPY server server
COPY client client
RUN bun run --filter @bounty/client build

ENV PORT=8080
EXPOSE 8080
CMD ["bun", "server/src/index.ts"]
