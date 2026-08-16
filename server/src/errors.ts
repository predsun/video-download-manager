export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const ErrorMessages: Record<string, string> = {
  INVALID_URL: 'URL 格式错误，请输入合法的视频链接',
  UNSUPPORTED_PLATFORM: '当前平台不支持',
  VIDEO_NOT_FOUND: '视频不存在或已被删除',
  VIDEO_UNAVAILABLE: '视频资源不可访问（可能受地区限制、需登录或已私有化）',
  NETWORK_ERROR: '网络连接中断，请检查网络后重试',
  DOWNLOAD_FAILED: '下载失败',
  TIMEOUT: '下载超时，请稍后重试',
  DISK_FULL: '磁盘空间不足',
  WRITE_FAILED: '文件写入失败',
  YTDLP_NOT_FOUND: '下载引擎 (yt-dlp) 未找到，请检查安装',
  FFMPEG_NOT_FOUND: '缺少 ffmpeg，无法合并音视频流，请安装 ffmpeg 或选择 MP4 渐进式格式',
  DUPLICATE: '该视频已在下载队列中',
  NOT_FOUND: '任务不存在',
};

export function badRequest(code: string): AppError {
  return new AppError(code, ErrorMessages[code] ?? code, 400);
}

export function notFound(code = 'NOT_FOUND'): AppError {
  return new AppError(code, ErrorMessages[code] ?? code, 404);
}

// 将 yt-dlp 的原始输出归类为用户可读的失败原因
export function classifyYtdlpError(output: string): { code: string; message: string } {
  const s = output.toLowerCase();
  if (/http error 404|unable to download webpage.*404/i.test(s)) {
    return { code: 'VIDEO_NOT_FOUND', message: ErrorMessages.VIDEO_NOT_FOUND };
  }
  if (/no space left on device|disk full|enospc/i.test(s)) {
    return { code: 'DISK_FULL', message: ErrorMessages.DISK_FULL };
  }
  if (/timed out|timeout|read timed out|operation timed out/i.test(s)) {
    return { code: 'TIMEOUT', message: ErrorMessages.TIMEOUT };
  }
  if (/unable to download webpage|urlopen error|getaddrinfo|connection (reset|refused|aborted)|network is unreachable|ssl.*error|errno/i.test(s)) {
    return { code: 'NETWORK_ERROR', message: ErrorMessages.NETWORK_ERROR };
  }
  if (/this video is not available|video unavailable|has been removed|private video|premium content|members-only|not available in your country|georestricted|geo-restricted|sign in|login required/i.test(s)) {
    return { code: 'VIDEO_UNAVAILABLE', message: ErrorMessages.VIDEO_UNAVAILABLE };
  }
  if (/unsupported url|no suitable extractor|is not a valid url|unable to extract/i.test(s)) {
    return { code: 'UNSUPPORTED_PLATFORM', message: ErrorMessages.UNSUPPORTED_PLATFORM };
  }
  if (/ffmpeg (not found|is not installed)|ffprobe|no such file or directory.*ffmpeg/i.test(s)) {
    return { code: 'FFMPEG_NOT_FOUND', message: ErrorMessages.FFMPEG_NOT_FOUND };
  }
  if (/permission denied|cannot open|read-only file system|enospc|error writing/i.test(s)) {
    return { code: 'WRITE_FAILED', message: ErrorMessages.WRITE_FAILED };
  }
  return { code: 'DOWNLOAD_FAILED', message: ErrorMessages.DOWNLOAD_FAILED };
}
