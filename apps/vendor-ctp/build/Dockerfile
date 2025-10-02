FROM debian:bookworm AS build_env

RUN apt-get update && apt-get install -y \
    gcc \
    cmake \
    make \
    libspdlog-dev \
    pkg-config \
    cppzmq-dev \
    wget \
    git \
    build-essential

RUN mkdir /cppzmq && \
    wget -O - https://github.com/zeromq/cppzmq/archive/refs/tags/v4.9.0.tar.gz | tar -zxv -C /cppzmq && \
    cd /cppzmq/cppzmq-4.9.0 && \
    rm -rf build && \
    mkdir build && \
    cd build && \
    cmake .. && \
    make -j4 install && \
    cd / && \
    rm -rf /cppzmq

FROM build_env AS builder

COPY ./out/vendor-ctp-out/apps/vendor-ctp/ctp /app/apps/vendor-ctp

WORKDIR /app/apps/vendor-ctp

# RUN wget -O - https://github.com/gabime/spdlog/archive/refs/tags/v1.10.0.tar.gz | tar -zxv -C spdlog && \
#     cp -r spdlog/spdlog-1.10.0/include/spdlog include && \
#     rm -rf spdlog

RUN ./scripts/build-variants.sh


# 将构建产物复制到挂载目录
# RUN --mount=type=bind,source=../../apps/vendor-ctp/ctp,target=/mnt/output \
#     cp -r /app/apps/vendor-ctp/build /mnt/output/

FROM node:22.14.0-bookworm

RUN apt-get update && apt-get install -y \
    libspdlog-dev \
    libzmq3-dev

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals
ARG TINI_VERSION=v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod a+x /tini
ENTRYPOINT ["/tini", "--"]

ENV NODE_ENV=production

USER node

WORKDIR /app

COPY --chown=node:node ./out/vendor-ctp-out /app

RUN node create-links.js create

WORKDIR /app/apps/vendor-ctp

COPY --from=builder --chown=node:node /app/apps/vendor-ctp/ctp/build ./build
COPY --from=builder --chown=node:node /app/apps/vendor-ctp/ctp/lib ./lib

CMD ["node", "./lib/exchange.js"]
