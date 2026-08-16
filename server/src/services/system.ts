import { accessSync, constants, statSync, statfsSync } from 'node:fs';
import { config } from '../config';
import { getDb } from '../db';
import { getSettings } from './settings';
import { findFfmpeg, findYtdlp } from './ytdlp';
import { SystemInfo } from '../types';

function dirInfo(dir: string): { ok: boolean; writable: boolean } {
  try {
    accessSync(dir, constants.W_OK);
    return { ok: true, writable: true };
  } catch {
    try {
      accessSync(dir, constants.F_OK);
      return { ok: true, writable: false };
    } catch {
      return { ok: false, writable: false };
    }
  }
}

export function getSystemInfo(): SystemInfo {
  const db = getDb();
  const settings = getSettings();

  let dbSize = 0;
  try {
    dbSize = statSync(config.dbPath).size;
  } catch {
    dbSize = 0;
  }

  let disk = { total: 0, free: 0, used: 0 };
  try {
    const s = statfsSync(config.rootDir);
    disk = {
      total: Number(s.blocks) * Number(s.bsize),
      free: Number(s.bavail) * Number(s.bsize),
      used: (Number(s.blocks) - Number(s.bfree)) * Number(s.bsize),
    };
  } catch {
    /* 某些平台不支持 statfs */
  }

  return {
    version: config.version,
    dbStatus: {
      ok: dbSize > 0,
      path: config.dbPath,
      sizeBytes: dbSize,
    },
    downloadDir: {
      ...dirInfo(settings.downloadDir),
      path: settings.downloadDir,
    },
    disk,
    engine: {
      ytdlp: findYtdlp(),
      ffmpeg: findFfmpeg(),
    },
  };
}
