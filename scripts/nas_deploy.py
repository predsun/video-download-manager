#!/usr/bin/env python3
"""Deploy the app to a QNAP NAS (Container Station) via Docker.
Credentials via env: NAS_HOST / NAS_USER / NAS_PASS"""
import os
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
APP_DIR = "/share/CACHEDEV1_DATA/vdm"
DL_DIR = "/share/CACHEDEV1_DATA/Public/VideoDownloadManager"
TAR_LOCAL = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "vdm-deploy.tar.gz"))
TAR_REMOTE = "/share/CACHEDEV1_DATA/vdm-deploy.tar.gz"

BASE_YML = f"{APP_DIR}/docker-compose.yml"
NAS_YML = f"{APP_DIR}/docker-compose.nas.yml"

COMPOSE_OVERRIDE = """\
# NAS override: bind mounts so downloads are visible in File Station
services:
  app:
    volumes:
      - /share/CACHEDEV1_DATA/vdm/data:/app/data
      - /share/CACHEDEV1_DATA/Public/VideoDownloadManager:/downloads
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
    print(f"== uploading project to {HOST} ==")
    c = connect()
    sftp = c.open_sftp()
    sftp.put(TAR_LOCAL, TAR_REMOTE)
    sftp.close()

    print("== extracting and preparing dirs ==")
    code, out = run(f"mkdir -p {APP_DIR} {DL_DIR} && tar -xzf {TAR_REMOTE} -C {APP_DIR} && echo EXTRACT_OK")
    print(out.strip())
    if code != 0 or "EXTRACT_OK" not in out:
        print("[deploy] extract failed")
        sys.exit(1)

    sftp = c.open_sftp()
    with sftp.open(NAS_YML, "w") as f:
        f.write(COMPOSE_OVERRIDE)
    sftp.close()
    print("wrote docker-compose.nas.yml")
    c.close()

    docker = f"{DOCKER_BIN_DIR}/docker"
    compose = f"{docker} compose -f {BASE_YML} -f {NAS_YML}"

    print("== building image (using CN mirrors) ==")
    build_args = (
        "--build-arg APT_MIRROR=mirrors.tuna.tsinghua.edu.cn "
        "--build-arg PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple"
    )
    code = run_stream(sudo(f"{compose} build {build_args}"), timeout=2400)
    if code != 0:
        print(f"\n[deploy] build failed (exit {code})")
        sys.exit(1)

    print("\n== starting container ==")
    code, out = run(sudo(f"{compose} up -d"), timeout=300)
    print(out)
    if code != 0:
        print("[deploy] up failed")
        sys.exit(1)

    print("== verify ==")
    code, out = run(sudo(f"{docker} ps -a --filter name=vdm"), timeout=60)
    print(out)
    code, out = run("curl -s --max-time 15 http://127.0.0.1:8787/api/health", timeout=30)
    print(f"health: {out.strip()}")
    print("[deploy] done")


if __name__ == "__main__":
    main()
