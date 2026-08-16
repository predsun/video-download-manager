// 压力测试：同时加入 20 个任务（唯一 URL），验证并发限制、队列、状态与完成情况。
// 用法：node scripts/stress-test.mjs   （需先启动后端，并建议在 9998 端口启动快速测试源）
const BASE = process.env.API_BASE ?? 'http://localhost:8787';
const STRESS_BASE = process.env.STRESS_BASE ?? 'http://localhost:9998';
const COUNT = Number(process.env.STRESS_COUNT ?? 20);

async function req(path, opts = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = opts.body != null ? { 'Content-Type': 'application/json' } : undefined;
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, ...opts, headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n=== 压力测试：${COUNT} 个任务，并发限制 3 ===\n`);

  await req('/api/settings', { method: 'PUT', body: JSON.stringify({ maxConcurrency: 3 }) });

  const created = [];
  for (let i = 0; i < COUNT; i++) {
    const url = `${STRESS_BASE}/video-${i}.mp4`;
    const r = await req('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ url, quality: 'best', format: 'best' }),
    });
    if (r.status === 201) created.push(r.data.id);
    else console.log(`  任务 ${i} 创建失败: ${r.status} ${r.data?.error?.code ?? ''}`);
  }
  console.log(`已创建任务：${created.length}/${COUNT}`);

  const start = Date.now();
  let maxConcurrent = 0;
  let maxQueue = 0;

  while (Date.now() - start < 240000) {
    const list = await req('/api/tasks');
    const mine = list.data.filter((t) => created.includes(t.id));
    const downloading = mine.filter((t) => t.status === 'downloading').length;
    const waiting = mine.filter((t) => t.status === 'waiting' || t.status === 'parsing').length;
    maxConcurrent = Math.max(maxConcurrent, downloading);
    maxQueue = Math.max(maxQueue, waiting);

    const done = mine.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status)).length;
    if (done >= created.length) break;
    await sleep(300);
  }

  const final = await req('/api/tasks');
  const mine = final.data.filter((t) => created.includes(t.id));
  const completed = mine.filter((t) => t.status === 'completed').length;
  const failed = mine.filter((t) => t.status === 'failed').length;
  const other = mine.length - completed - failed;

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n最大并发下载数：${maxConcurrent}（限制 3）`);
  console.log(`最大排队数：${maxQueue}`);
  console.log(`完成：${completed}，失败：${failed}，其他：${other}`);
  console.log(`总耗时：${elapsed}s`);

  const okConcurrency = maxConcurrent <= 3;
  const okCompleted = completed === COUNT && failed === 0;
  console.log(`\n结论：并发限制 ${okConcurrency ? '✓' : '✗'} | 全部完成 ${okCompleted ? '✓' : '✗'} (${completed}/${COUNT})`);
  return okConcurrency && okCompleted;
}

main()
  .then((ok) => process.exitCode = ok ? 0 : 1)
  .catch((e) => {
    console.error('压力测试异常:', e);
    process.exitCode = 1;
  });
