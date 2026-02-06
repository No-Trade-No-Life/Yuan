# syntax = docker/dockerfile:1.4

# ISSUE: debian adopt GLIBC 2.34 since bookworm, which is required by wrtc-linux-x86
FROM node:22.14.0-bookworm-slim

LABEL maintainer="Siyuan Wang <c.one@thrimbda.com>"

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals
ARG TINI_VERSION=v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod a+x /tini
ENTRYPOINT ["/tini", "--"]

RUN apt update && apt install -y vim curl wget dnsutils procps htop

# Install pnpm, pnpx
RUN npm install -g pnpm@latest-10

ENV NODE_ENV=production

USER node

WORKDIR /app

COPY --chown=node:node ./out/app-http-proxy-out /app

RUN node create-links.js create

WORKDIR /app/apps/http-proxy

CMD ["node", "--heapsnapshot-signal=SIGUSR2", "./lib/index.js"]
