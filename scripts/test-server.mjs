// 本地测试视频源：用于验证下载引擎（进度/暂停/恢复/取消）与压力测试，
// 无需依赖外部网络。支持 HTTP Range（断点续传）与限速。
import http from 'node:http';

const PORT = Number(process.env.TEST_PORT ?? 9999);
const SIZE = Number(process.env.TEST_SIZE ?? 64 * 1024 * 1024);
const SPEED = Number(process.env.TEST_SPEED ?? 0); // bytes/sec，0 = 不限速
const FAIL_FIRST = process.env.TEST_FAIL_FIRST === '1';

const payload = Buffer.alloc(SIZE);
// 填充可辨识内容，避免全零
for (let i = 0; i < SIZE; i += 4096) {
  payload.write(`chunk-${i}\n`, i, 'utf8');
}

let firstRequest = true;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/notfound.mp4') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }

  if (url.pathname === '/flaky.mp4' && FAIL_FIRST && firstRequest) {
    firstRequest = false;
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('service unavailable');
    return;
  }

  if (!url.pathname.endsWith('.mp4')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, size: SIZE }));
    return;
  }

  const range = req.headers.range;
  let start = 0;
  let end = SIZE - 1;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = Number(m[1]);
      if (m[2]) end = Number(m[2]);
      if (end >= SIZE) end = SIZE - 1;
    }
  }

  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
  };

  if (range) {
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${SIZE}`, 'Content-Length': end - start + 1 });
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': end - start + 1 });
  }

  let pos = start;
  const CHUNK = 256 * 1024;

  const pump = () => {
    if (pos > end) {
      res.end();
      return;
    }
    const remaining = end - pos + 1;
    const len = Math.min(CHUNK, remaining);
    res.write(payload.subarray(pos, pos + len));
    pos += len;

    if (SPEED > 0) {
      const delay = (len / SPEED) * 1000;
      setTimeout(pump, delay);
    } else {
      setImmediate(pump);
    }
  };
  pump();
});

server.listen(PORT, () => {
  console.log(`[test-server] listening on http://localhost:${PORT} (size=${SIZE}, speed=${SPEED || 'unlimited'})`);
});
