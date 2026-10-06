import { PlatformInfo } from '../types';

interface PlatformRule {
  id: string;
  name: string;
  hostnames: string[];
  patterns: RegExp[];
}

const RULES: PlatformRule[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    hostnames: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'],
    patterns: [/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtube-nocookie\.com)\/(watch|shorts|embed|live|v)\b/i, /^https?:\/\/youtu\.be\/[\w-]+/i],
  },
  {
    id: 'bilibili',
    name: 'Bilibili',
    hostnames: ['bilibili.com', 'www.bilibili.com', 'm.bilibili.com', 'b23.tv', 'bilibili.tv'],
    patterns: [/^https?:\/\/(www\.|m\.)?bilibili\.com\/video\/BV[\w]+/i, /^https?:\/\/b23\.tv\/[\w]+/i, /^https?:\/\/(www\.|m\.)?bilibili\.com\/bangumi\/play/i],
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    hostnames: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'],
    patterns: [/^https?:\/\/(www\.|player\.)?vimeo\.com\/\d+/i],
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    hostnames: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
    patterns: [/^https?:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\/\w+\/status\/\d+/i],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    hostnames: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'],
    patterns: [/^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\/(@[\w.-]+\/video\/\d+|[\w]+)/i],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    hostnames: ['instagram.com', 'www.instagram.com', 'instagr.am'],
    patterns: [/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|reels|p|tv|stories)\/[\w-]+/i],
  },
];

const DIRECT_EXT = /\.(mp4|webm|mkv|mov|m4v|flv|avi|mp3|m4a|aac|ogg|wav|opus|ts)(\?.*)?$/i;

export function normalizeUrl(input: string): URL | null {
  if (!input || input.length > 4096) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function validateUrl(input: string): { ok: boolean; url?: URL; error?: string } {
  const url = normalizeUrl(input);
  if (!url) {
    return { ok: false, error: 'INVALID_URL' };
  }
  return { ok: true, url };
}

// 归一化视频链接：去掉 YouTube 的播放列表/电台参数（list / start_radio / index / si 等），
// 只保留视频 ID，避免 yt-dlp 走电台/播放列表解析路径而触发更严格的风控
export function normalizeVideoUrl(rawUrl: string): string {
  const input = (rawUrl ?? '').trim();
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    if (/(^|\.)youtube\.com$|youtube-nocookie\.com$/.test(host)) {
      const v = url.searchParams.get('v');
      if (v) return `https://www.youtube.com/watch?v=${v}`;
      return input;
    }
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://youtu.be/${id}`;
      return input;
    }
    return input;
  } catch {
    return input;
  }
}

export function detectPlatform(rawUrl: string): PlatformInfo | null {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  for (const rule of RULES) {
    if (rule.hostnames.some((h) => host === h.replace(/^www\./, ''))) {
      // host 命中后仍需匹配具体路径，避免误判首页
      const matched = rule.patterns.some((p) => p.test(rawUrl.trim()));
      if (matched || host === 'youtu.be') {
        return { id: rule.id, name: rule.name };
      }
    }
  }

  // 直链媒体文件（便于本地/内网测试与通用下载）
  if (DIRECT_EXT.test(url.pathname)) {
    return { id: 'direct', name: 'Direct Link' };
  }

  return null;
}

export function isSupported(rawUrl: string): boolean {
  return detectPlatform(rawUrl) !== null;
}

export function platformName(rawUrl: string): string {
  return detectPlatform(rawUrl)?.name ?? 'Unknown';
}
