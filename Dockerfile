# ---- 构建阶段 ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM node:24-slim

# 可通过构建参数替换为国内镜像源（如 mirrors.tuna.tsinghua.edu.cn）
ARG APT_MIRROR=deb.debian.org
ARG PIP_INDEX=https://pypi.org/simple

RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir --break-system-packages -i ${PIP_INDEX} yt-dlp

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    DOWNLOAD_DIR=/downloads

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

VOLUME ["/app/data", "/downloads"]
EXPOSE 8787

CMD ["node", "--disable-warning=ExperimentalWarning", "server/dist/index.js"]
