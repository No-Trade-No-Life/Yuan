# syntax = docker/dockerfile:1.4

# ISSUE: debian adopt GLIBC 2.34 since bookworm, which is required by wrtc-linux-x86
FROM node:22.14.0-bookworm-slim

LABEL maintainer="Siyuan Wang <c.one@thrimbda.com>"

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals
ARG TINI_VERSION=v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod a+x /tini
ENTRYPOINT ["/tini", "--"]

USER node

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node ./out/vendor-huobi-out /app

RUN node create-links.js create

WORKDIR /app/apps/vendor-huobi

# USER nobody
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "./lib/cluster.js"]
