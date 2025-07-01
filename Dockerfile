# syntax=docker/dockerfile:1

FROM node:20.18.0-bookworm

ARG GA_ID

ENV TZ=Asia/Shanghai
ENV NEXT_PUBLIC_GA_ID=${GA_ID}
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY . .

# 创建必要的目录
RUN mkdir -p /app/packages/server/.run/logs
RUN mkdir -p /app/.run

EXPOSE 3000

RUN ./build.sh

CMD [ "/bin/sh", "./start.sh" ]
