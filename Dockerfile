
FROM oven/bun:1.1
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install
COPY . .
CMD ./scripts/docker-entrypoint.sh
