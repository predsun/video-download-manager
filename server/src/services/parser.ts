import { findFfmpeg, findYtdlp, runYtdlp } from './ytdlp';
import { detectPlatform } from '../platform/detect';
import { AppError, classifyYtdlpError, ErrorMessages } from '../errors';
import { getSettings } from './settings';
import {
  FormatOption,
  ParseResult,
  PlatformInfo,
  QualityOption,
  VideoFormat,
  VideoMeta,
} from '../types';

interface RawFormat {
  format_id?: string;
  ext?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  format_note?: string;
  resolution?: string;
}

interface RawInfo {
  id?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  channel?: string;
  webpage_url?: string;
  extractor?: string;
  formats?: RawFormat[];
  filesize?: number;
  filesize_approx?: number;
}

const VIDEO_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function buildFormats(raw: RawFormat[]): VideoFormat[] {
  return raw
    .map((f) => ({
      formatId: f.format_id ?? '',
      ext: f.ext ?? '',
      resolution: f.resolution ?? (f.width && f.height ? `${f.width}x${f.height}` : ''),
      height: asNum(f.height),
      fps: asNum(f.fps),
      vcodec: f.vcodec ?? 'none',
      acodec: f.acodec ?? 'none',
      filesize: asNum(f.filesize),
      filesizeApprox: asNum(f.filesize_approx),
      note: f.format_note ?? '',
    }))
    .filter((f) => f.formatId || f.ext);
}

function sizeOr(f: VideoFormat): number | null {
  return f.filesize ?? f.filesizeApprox ?? null;
}

function buildQualities(formats: VideoFormat[], totalFilesize: number | null): QualityOption[] {
  const videoFormats = formats.filter((f) => f.vcodec !== 'none' && f.height != null);
  const audioFormats = formats.filter((f) => f.acodec !== 'none' && f.vcodec === 'none');
  const bestAudioSize = audioFormats
    .map(sizeOr)
    .filter((n): n is number => n != null)
    .sort((a, b) => b - a)[0] ?? null;

  const heights = Array.from(new Set(videoFormats.map((f) => f.height as number)))
    .filter((h) => VIDEO_HEIGHTS.includes(h))
    .sort((a, b) => b - a);

  const qualities: QualityOption[] = [
    { value: 'best', label: '最佳质量', height: null, filesize: totalFilesize },
  ];

  for (const h of heights) {
    const candidates = videoFormats.filter((f) => f.height === h);
    const best = candidates
      .map(sizeOr)
      .filter((n): n is number => n != null)
      .sort((a, b) => b - a)[0] ?? null;
    const est = best != null && bestAudioSize != null ? best + bestAudioSize : best;
    qualities.push({ value: String(h), label: `${h}p`, height: h, filesize: est });
  }

  if (audioFormats.length > 0) {
    qualities.push({ value: 'audio', label: '仅音频', height: null, filesize: bestAudioSize });
  }
  return qualities;
}

function buildFormatOptions(formats: VideoFormat[], hasFfmpeg: boolean): FormatOption[] {
  const videoExts = new Set(formats.filter((f) => f.vcodec !== 'none').map((f) => f.ext));
  const options: FormatOption[] = [{ value: 'best', label: '自动 (推荐)' }];
  if (videoExts.has('mp4')) options.push({ value: 'mp4', label: 'MP4' });
  if (videoExts.has('webm')) options.push({ value: 'webm', label: 'WebM' });
  if (hasFfmpeg) options.push({ value: 'mkv', label: 'MKV' });
  options.push({ value: 'm4a', label: 'M4A (音频)' });
  if (hasFfmpeg) options.push({ value: 'mp3', label: 'MP3 (音频)' });
  return options;
}

export async function parseUrl(rawUrl: string): Promise<ParseResult> {
  const platform = detectPlatform(rawUrl);
  if (!platform) {
    throw new AppError('UNSUPPORTED_PLATFORM', ErrorMessages.UNSUPPORTED_PLATFORM, 400);
  }

  const bin = findYtdlp();
  if (!bin) {
    throw new AppError('YTDLP_NOT_FOUND', ErrorMessages.YTDLP_NOT_FOUND, 500);
  }

  const settings = getSettings();
  const args = [
    '--dump-single-json',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout',
    String(settings.timeoutSec),
    '--retries',
    String(settings.retries),
    rawUrl.trim(),
  ];
  const res = await runYtdlp(args, settings.timeoutSec * 1000 * 2);

  if (res.code !== 0 || !res.stdout.trim()) {
    const { code, message } = classifyYtdlpError(res.stderr || res.stdout);
    const statusCode = code === 'YTDLP_NOT_FOUND' ? 500 : 400;
    throw new AppError(code, message, statusCode);
  }

  let info: RawInfo;
  try {
    info = JSON.parse(res.stdout);
  } catch {
    throw new AppError('DOWNLOAD_FAILED', ErrorMessages.DOWNLOAD_FAILED, 502);
  }

  const formats = buildFormats(info.formats ?? []);
  const meta: VideoMeta = {
    id: info.id ?? '',
    title: info.title ?? '未命名视频',
    thumbnail: info.thumbnail ?? '',
    duration: asNum(info.duration),
    uploader: info.uploader ?? info.channel ?? null,
    webpageUrl: info.webpage_url ?? rawUrl,
    extractor: info.extractor ?? platform.id,
    formats,
  };

  const totalFilesize = asNum(info.filesize) ?? asNum(info.filesize_approx) ?? null;

  return {
    platform,
    meta,
    qualities: buildQualities(formats, totalFilesize),
    formats: buildFormatOptions(formats, findFfmpeg() !== null),
  };
}
