// 浏览器 UI 测试（Playwright / headless Chromium）
// 用法：node scripts/ui-test.mjs   （需先启动后端，并建议启动 scripts/test-server.mjs）
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const TEST_URL = process.env.TEST_URL ?? 'http://localhost:9999/video.mp4';

// 自动探测本地已安装的 Chromium（兼容不同 Playwright 修订号）
function findChromium() {
  const candidates = [];
  const base = process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', 'AppData', 'Local');
  const root = path.join(base, 'ms-playwright');
  try {
    for (const dir of readdirSync(root)) {
      if (dir.startsWith('chromium-')) {
        candidates.push(path.join(root, dir, 'chrome-win64', 'chrome.exe'));
        candidates.push(path.join(root, dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
      }
    }
  } catch {
    /* ignore */
  }
  candidates.push(chromium.executablePath());
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

let passed = 0;
let failed = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function main() {
  console.log(`\n=== UI 测试 (${BASE}) ===\n`);
  const exe = findChromium();
  console.log(`使用浏览器: ${exe ?? '(default)'}`);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  // ---------- 桌面端 ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });

  ok('首页打开（标题）', (await page.title()).includes('在线视频下载管理器'));
  ok('首页主标题', await page.getByRole('heading', { name: '在线视频下载管理器' }).isVisible());
  ok('首页副标题', await page.getByText('统一管理你的在线视频下载任务').isVisible());

  const input = page.getByPlaceholder('粘贴视频链接');
  ok('URL 输入框', await input.isVisible());

  // URL 校验
  await input.fill('not-a-url');
  await page.getByRole('button', { name: '解析视频' }).click();
  await page.waitForTimeout(600);
  ok('非法 URL 提示', await page.getByText(/URL 格式错误/).first().isVisible());

  // 平台识别 + 预览
  await input.fill(TEST_URL);
  await page.getByRole('button', { name: '解析视频' }).click();
  await page.waitForSelector('text=加入下载队列', { timeout: 20000 });
  ok('解析预览卡片', await page.getByRole('button', { name: '加入下载队列' }).isVisible());
  ok('平台标识（Direct Link）', await page.getByText('Direct Link').first().isVisible());

  // 加入下载队列
  await page.getByRole('button', { name: '加入下载队列' }).click();
  await page.waitForTimeout(800);
  ok('加入队列 Toast', await page.getByText('已加入下载队列').first().isVisible());

  // 任务页
  await page.getByRole('link', { name: '下载任务' }).click();
  await page.waitForSelector('text=下载任务', { timeout: 10000 });
  ok('任务页打开', await page.getByRole('heading', { name: '下载任务' }).isVisible());
  ok('任务卡片出现', await page.locator('text=video.mp4').first().isVisible({ timeout: 15000 }));

  // Dashboard
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.waitForSelector('text=累计任务', { timeout: 10000 });
  ok('Dashboard 统计卡', await page.getByText('累计下载').isVisible());
  ok('Dashboard 成功率', await page.getByText('成功率').isVisible());

  // 历史
  await page.getByRole('link', { name: '下载历史' }).click();
  await page.waitForSelector('text=下载历史', { timeout: 10000 });
  ok('历史页打开', await page.getByRole('heading', { name: '下载历史' }).isVisible());

  // 设置 + 暗色模式
  await page.getByRole('link', { name: '设置' }).click();
  await page.waitForSelector('text=下载设置', { timeout: 10000 });
  ok('设置页打开', await page.getByText('下载设置').isVisible());
  await page.getByRole('button', { name: 'Dark Mode' }).click();
  await page.waitForTimeout(300);
  ok('Dark Mode 生效', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await page.getByRole('button', { name: 'Light Mode' }).click();
  await page.waitForTimeout(200);

  // ---------- 移动端 ----------
  const mobile = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
  ok('移动端无横向滚动', scrollW <= 376, `scrollWidth=${scrollW}`);
  ok('移动端菜单按钮', await mobile.getByLabel('打开菜单').isVisible());
  await mobile.getByLabel('打开菜单').click();
  ok('移动端抽屉导航', await mobile.getByRole('link', { name: '下载任务' }).isVisible());
  await mobile.close();

  await page.close();
  await browser.close();

  console.log(`\n=== UI 结果：${passed} 通过，${failed} 失败 ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('UI 测试异常:', e);
  process.exit(1);
});
