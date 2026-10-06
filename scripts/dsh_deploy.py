#!/usr/bin/env python3
"""Deploy a second DeepSeek Harness (dsh web) instance to QNAP NAS via Docker.
DSH binds 127.0.0.1 (its safety requirement); an nginx reverse proxy with
HTTP Basic Auth exposes it on the LAN at port 3080.
Credentials via env: NAS_HOST / NAS_USER / NAS_PASS"""
import os
import secrets
import socket
import sys

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = os.environ.get("NAS_HOST", "10.190.1.100")
USER = os.environ.get("NAS_USER", "adminlisj")
PASS = os.environ.get("NAS_PASS", "")

DOCKER_BIN_DIR = "/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin"
DSH_DIR = "/share/CACHEDEV1_DATA/dsh"
TAR_LOCAL = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dsh-home.tar.gz"))
TAR_REMOTE = "/share/CACHEDEV1_DATA/dsh-home.tar.gz"

# 反向代理暴露端口 + DSH 内部端口
PROXY_PORT = 3080
DSH_PORT = 13080
# 访问鉴权（HTTP Basic Auth）
AUTH_USER = "admin"
AUTH_PASS = secrets.token_hex(8)

DOCKERFILE = f"""\
FROM node:24-slim
ARG APT_MIRROR=deb.debian.org
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \\
      sed -i "s|deb.debian.org|${{APT_MIRROR}}|g" /etc/apt/sources.list.d/debian.sources; \\
    elif [ -f /etc/apt/sources.list ]; then \\
      sed -i "s|deb.debian.org|${{APT_MIRROR}}|g" /etc/apt/sources.list; \\
    fi \\
  && apt-get update \\
  && apt-get install -y --no-install-recommends python3 make g++ \\
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --no-audit --no-fund @deepseek-ai/dsh@0.1.0-rc.6
ENV DSH_HOME=/data/.dsh
EXPOSE {DSH_PORT}
CMD ["sh", "-c", "chmod 700 /data/.dsh 2>/dev/null; chmod 600 /data/.dsh/.credentials.yaml 2>/dev/null; exec dsh web --port {DSH_PORT} --trusted-host {HOST}:{PROXY_PORT}"]
"""

COMPOSE = f"""\
services:
  dsh:
    build: .
    container_name: deepseek-harness
    network_mode: host
    environment:
      - DSH_HOME=/data/.dsh
    volumes:
      - ./data:/data
      - ./workspace:/workspace
    working_dir: /workspace
    restart: unless-stopped
  proxy:
    image: nginx:latest
    container_name: dsh-proxy
    network_mode: host
    volumes:
      - ./proxy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./proxy/.htpasswd:/etc/nginx/.htpasswd:ro
    depends_on:
      - dsh
    restart: unless-stopped
"""

NGINX_CONF = f"""\
server {{
    listen {PROXY_PORT};
    server_name _;

    location / {{
        auth_basic "DeepSeek Harness";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://127.0.0.1:{DSH_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }}
}}
"""


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=22, username=USER, password=PASS, timeout=30,
              look_for_keys=False, allow_agent=False)
    return c


def sudo(cmd):
    return f"echo '{PASS}' | sudo -S {cmd}"


def run(cmd, timeout=600):
    c = connect()
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    c.close()
    if err and "Password:" not in err:
        sys.stderr.write(err)
    return code, out


def run_stream(cmd, timeout=2400):
    c = connect()
    t = c.get_transport()
    t.set_keepalive(30)
    chan = t.open_session()
    chan.get_pty()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    while True:
        try:
            chunk = chan.recv(4096)
        except socket.timeout:
            print("\n[deploy] command timed out")
            break
        if not chunk:
            break
        sys.stdout.write(chunk.decode("utf-8", "replace"))
        sys.stdout.flush()
    code = chan.recv_exit_status()
    c.close()
    return code


def main():
    print(f"== deploying DSH (+auth proxy) to {HOST} ==")
    print(f"== access: http://{HOST}:{PROXY_PORT}  user={AUTH_USER} pass={AUTH_PASS} ==")

    c = connect()
    sftp = c.open_sftp()
    if os.path.exists(TAR_LOCAL):
        sftp.put(TAR_LOCAL, TAR_REMOTE)
    sftp.close()

    print("== preparing dirs ==")
    code, out = run(f"mkdir -p {DSH_DIR}/data {DSH_DIR}/workspace {DSH_DIR}/proxy")
    print(out.strip())
    if code != 0:
        print("[deploy] mkdir failed")
        sys.exit(1)

    # 解压配置（若存在）
    code, out = run(f"if [ -f {TAR_REMOTE} ]; then tar -xzf {TAR_REMOTE} -C {DSH_DIR}/data && echo EXTRACT_OK; else echo SKIP_TAR; fi")
    print(out.strip())

    # 生成 htpasswd（在 NAS 上用 openssl，避免明文出现在命令行）
    code, ht = run(f"printf '%s' '{AUTH_PASS}' | openssl passwd -apr1 -stdin")
    ht = ht.strip()
    if not ht.startswith("$apr1$"):
        print(f"[deploy] htpasswd generation failed: {ht}")
        sys.exit(1)

    sftp = c.open_sftp()
    with sftp.open(f"{DSH_DIR}/Dockerfile", "w") as f:
        f.write(DOCKERFILE)
    with sftp.open(f"{DSH_DIR}/docker-compose.yml", "w") as f:
        f.write(COMPOSE)
    with sftp.open(f"{DSH_DIR}/proxy/nginx.conf", "w") as f:
        f.write(NGINX_CONF)
    with sftp.open(f"{DSH_DIR}/proxy/.htpasswd", "w") as f:
        f.write(f"{AUTH_USER}:{ht}\n")
    sftp.close()
    print("wrote Dockerfile + compose + nginx.conf + .htpasswd")
    c.close()

    docker = f"{DOCKER_BIN_DIR}/docker"
    compose = f"{docker} compose -f {DSH_DIR}/docker-compose.yml"

    print("== building dsh image (cached if unchanged) ==")
    code = run_stream(sudo(f"{compose} build --build-arg APT_MIRROR=mirrors.tuna.tsinghua.edu.cn"), timeout=2400)
    if code != 0:
        print(f"\n[deploy] build failed (exit {code})")
        sys.exit(1)

    print("\n== starting dsh + proxy ==")
    code, out = run(sudo(f"{compose} up -d"), timeout=300)
    print(out)
    if code != 0:
        print("[deploy] up failed")
        sys.exit(1)

    print("== verify ==")
    code, out = run(sudo(f"{docker} ps -a --filter name=dsh --format '{{{{.Names}}}} {{{{.Status}}}}'"), timeout=60)
    print(out)

    print(f"\n[deploy] done — access http://{HOST}:{PROXY_PORT} (user={AUTH_USER}, pass={AUTH_PASS})")


if __name__ == "__main__":
    main()
