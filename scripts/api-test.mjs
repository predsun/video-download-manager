// API 冒烟/功能测试：针对运行中的后端执行端到端任务流程验证。
// 用法：node scripts/api-test.mjs   （需先启动后端，并建议启动 scripts/test-server.mjs）
const BASE = process.env.API_BASE ?? 'http://localhost:8787';
const TEST_URL = process.env.TEST_URL ?? 'http://localhost:9999/video.mp4';

let passed = 0;
let failed = 0;
const results = [];

function ok(name, cond, extra = '') {
  if (cond) {
    passed++;
    results.push(`  ✓ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    results.push(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
  console.log(results[results.length - 1]);
}

async function req(path, opts = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = opts.body != null ? { 'Content-Type': 'application/json' } : undefined;
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      ...opts,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(taskId, predicate, timeoutMs = 60000, label = '') {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const { data } = await req(`/api/tasks/${taskId}`);
    last = data;
    if (predicate(data)) return data;
    await sleep(250);
  }
  return last;
}

async function main() {
  console.log(`\n=== API 测试 (${BASE}) ===\n`);

  // 1. 健康检查
  const health = await req('/api/health');
  ok('健康检查', health.status === 200 && health.data.ok === true);

  // 2. URL 校验
  let r = await req('/api/tasks/parse', { method: 'POST', body: JSON.stringify({ url: 'not-a-url' }) });
  ok('URL 格式校验（非法输入 → 400）', r.status === 400 && r.data.error?.code === 'INVALID_URL');

  r = await req('/api/tasks/parse', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/some-page' }) });
  ok('平台识别（不支持的平台 → 400）', r.status === 400 && r.data.error?.code === 'UNSUPPORTED_PLATFORM');

  // 3. 解析直链
  r = await req('/api/tasks/parse', { method: 'POST', body: JSON.stringify({ url: TEST_URL }) });
  ok('解析直链元数据', r.status === 200 && r.data.platform?.id === 'direct', `title=${r.data.meta?.title}`);

  // 4. 创建任务并观察进度
  r = await req('/api/tasks', { method: 'POST', body: JSON.stringify({ url: TEST_URL, quality: 'best', format: 'best' }) });
  ok('创建任务', r.status === 201 && r.data.id, `id=${r.data.id?.slice(0, 8)}`);
  const task1 = r.data.id;

  let t = await waitFor(task1, (d) => d.status === 'downloading' && d.progress > 5, 30000, '下载进度>5%');
  ok('进入下载并产生进度', t?.status === 'downloading' && t?.progress > 5, `progress=${Math.round(t?.progress ?? 0)}%`);

  // 5. 暂停
  await req(`/api/tasks/${task1}/pause`, { method: 'POST' });
  t = await waitFor(task1, (d) => d.status === 'paused', 15000, '暂停');
  const pausedProgress = t?.progress ?? 0;
  await sleep(2000);
  const frozen = await req(`/api/tasks/${task1}`);
  ok('暂停（进度冻结）', frozen.data.status === 'paused' && Math.abs(frozen.data.progress - pausedProgress) < 0.5, `冻结于 ${Math.round(pausedProgress)}%`);

  // 6. 继续
  await req(`/api/tasks/${task1}/resume`, { method: 'POST' });
  t = await waitFor(task1, (d) => d.status === 'completed', 90000, '完成');
  ok('继续并完成下载', t?.status === 'completed' && t?.progress === 100, `filesize=${t?.filesize ?? 0} bytes`);
  ok('记录文件路径', typeof t?.filePath === 'string' && t.filePath.length > 0, t?.filePath);

  // 7. 重复下载检测（活跃任务）
  r = await req('/api/tasks', { method: 'POST', body: JSON.stringify({ url: TEST_URL, quality: 'best', format: 'best' }) });
  const task2 = r.data.id;
  t = await waitFor(task2, (d) => d.status === 'downloading', 15000, '第二个任务开始');
  const dup = await req('/api/tasks', { method: 'POST', body: JSON.stringify({ url: TEST_URL, quality: 'best', format: 'best' }) });
  ok('重复下载检测（活跃中 → 409）', dup.status === 409 && dup.data.error?.code === 'DUPLICATE');

  // 8. 取消（第二个任务）
  await req(`/api/tasks/${task2}/cancel`, { method: 'POST' });
  t = await waitFor(task2, (d) => d.status === 'cancelled', 15000, '取消');
  ok('取消任务', t?.status === 'cancelled');

  // 9. 重试（被取消的任务 → 重新下载完成）
  await req(`/api/tasks/${task2}/retry`, { method: 'POST' });
  t = await waitFor(task2, (d) => d.status === 'completed', 90000, '重试后完成');
  ok('重试被取消的任务并完成', t?.status === 'completed');

  // 10. 失败与明确错误
  r = await req('/api/tasks', { method: 'POST', body: JSON.stringify({ url: 'http://localhost:9999/notfound.mp4', quality: 'best', format: 'best' }) });
  const task3 = r.data.id;
  t = await waitFor(task3, (d) => d.status === 'failed', 30000, '失败');
  ok('失败任务带明确原因', t?.status === 'failed' && typeof t?.error === 'string' && t.error.length > 0, t?.error);

  // 11. 重试失败任务（状态机：failed → waiting → 再 failed）
  await req(`/api/tasks/${task3}/retry`, { method: 'POST' });
  t = await waitFor(task3, (d) => d.status === 'failed', 30000, '重试再次失败');
  ok('重试失败任务（保持 failed + 原因）', t?.status === 'failed' && !!t?.error);

  // 12. 历史
  r = await req('/api/history?status=completed');
  ok('历史记录（按状态筛选）', r.status === 200 && Array.isArray(r.data) && r.data.every((x) => x.status === 'completed'), `count=${r.data.length}`);

  // 13. Dashboard
  r = await req('/api/dashboard');
  const d = r.data;
  ok('Dashboard 统计', r.status === 200 && d.totalTasks >= 3 && d.completed >= 2 && typeof d.successRate === 'number', `total=${d.totalTasks} done=${d.completed}`);

  // 14. Settings
  r = await req('/api/settings', { method: 'PUT', body: JSON.stringify({ maxConcurrency: 5 }) });
  ok('更新设置（并发数 → 5）', r.status === 200 && r.data.maxConcurrency === 5);
  r = await req('/api/settings', { method: 'PUT', body: JSON.stringify({ maxConcurrency: 3 }) });
  ok('恢复设置（并发数 → 3）', r.status === 200 && r.data.maxConcurrency === 3);

  // 15. System
  r = await req('/api/system');
  ok('系统信息（引擎已就绪）', r.status === 200 && !!r.data.engine?.ytdlp, `ytdlp=${r.data.engine?.ytdlp ? 'ok' : 'missing'}`);

  console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('测试脚本异常:', e);
  process.exit(1);
});
