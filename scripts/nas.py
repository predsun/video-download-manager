#!/usr/bin/env python3
"""QNAP NAS 部署辅助工具：通过 SSH 执行命令 / 上传文件。
凭证通过环境变量传入：NAS_HOST / NAS_USER / NAS_PASS"""
import os
import sys
import paramiko


def connect():
    host = os.environ.get("NAS_HOST", "10.190.1.100")
    user = os.environ.get("NAS_USER", "adminlisj")
    password = os.environ.get("NAS_PASS", "")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, port=22, username=user, password=password, timeout=20,
                   look_for_keys=False, allow_agent=False)
    return client


def run(cmd, timeout=120):
    client = connect()
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    return code, out, err


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: nas.py <command>")
        sys.exit(1)
    command = sys.argv[1]
    code, out, err = run(command)
    sys.stdout.write(out)
    if err:
        sys.stderr.write(err)
    sys.exit(code)
