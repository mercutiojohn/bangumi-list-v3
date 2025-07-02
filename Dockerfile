# syntax=docker/dockerfile:1

FROM node:20.18.0-bookworm

ARG GA_ID
ARG COMMIT_HASH
ARG BUILD_TIME

ENV TZ=Asia/Shanghai
ENV NEXT_PUBLIC_GA_ID=${GA_ID}
ENV COMMIT_HASH=${COMMIT_HASH}
ENV BUILD_TIME=${BUILD_TIME}
ENV DATA_DIR=/app/.run
ENV RUNTIME_DIR=/app/.run
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p /app/.run/logs && \
    mkdir -p /app/packages/server/.run/logs && \
    chmod -R 755 /app/.run

EXPOSE 3000

RUN ./build.sh

CMD [ "/bin/sh", "./start.sh" ]
