# The web app: Next.js, as a self-contained server. Build context is ./frontend.
FROM node:22-alpine AS build

ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Where the web app's /api proxy sends requests. Next resolves rewrites when it builds, so this is
# fixed in the image: it is the backend's name on the compose network.
ARG API_URL=http://backend:8000
ENV API_URL=$API_URL \
    NEXT_OUTPUT=standalone
# Not `pnpm build`: that first regenerates the design tokens from ../design-system, which is outside
# this build context. src/styles/tokens.css is committed, and `pnpm lint` (run by CI) fails when it
# is out of date, so the image uses it as it is.
RUN pnpm exec next build


FROM node:22-alpine

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
