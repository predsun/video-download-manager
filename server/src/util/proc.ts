import { spawn, ChildProcess } from 'node:child_process';

/**
 * 结束进程树。
 *
 * Windows 上控制台程序收不到 SIGTERM，因此无论「暂停」还是「取消」都用
 * `taskkill /T /F` 强制结束整个进程树（避免 ffmpeg 等孙进程残留）。
 * .part 分片文件会保留，恢复下载时由 yt-dlp --continue 断点续传。
 */
export function killProcessTree(child: ChildProcess, force: boolean): Promise<void> {
  return new Promise((resolve) => {
    const pid = child.pid;
    if (!pid) return resolve();

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        resolve();
      });
      killer.on('close', () => resolve());
      return;
    }

    child.kill(force ? 'SIGKILL' : 'SIGTERM');
    if (force) return resolve();

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
