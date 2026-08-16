import { getDb } from '../db';
import { config } from '../config';
import { AppSettings, ThemeMode } from '../types';

const VALID_CONCURRENCY = [1, 2, 3, 5, 10];

function str<T>(v: string | null, fallback: T): T {
  return (v as unknown as T) ?? fallback;
}

export function getSettings(): AppSettings {
  const db = getDb();
  const num = (key: string, fallback: number) => {
    const v = db.getSetting(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const maxConcurrency = num('maxConcurrency', config.defaults.maxConcurrency);
  return {
    defaultQuality: str(db.getSetting('defaultQuality'), config.defaults.defaultQuality),
    defaultFormat: str(db.getSetting('defaultFormat'), config.defaults.defaultFormat),
    maxConcurrency: VALID_CONCURRENCY.includes(maxConcurrency) ? maxConcurrency : config.defaults.maxConcurrency,
    downloadDir: str(db.getSetting('downloadDir'), config.downloadDir),
    maxSpeed: num('maxSpeed', config.defaults.maxSpeed),
    timeoutSec: num('timeoutSec', config.defaults.timeoutSec),
    retries: num('retries', config.defaults.retries),
    theme: str<ThemeMode>(db.getSetting('theme'), 'system'),
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const db = getDb();
  const current = getSettings();
  const next: AppSettings = { ...current };

  if (patch.defaultQuality != null) next.defaultQuality = patch.defaultQuality;
  if (patch.defaultFormat != null) next.defaultFormat = patch.defaultFormat;
  if (patch.maxConcurrency != null) {
    const v = Number(patch.maxConcurrency);
    if (VALID_CONCURRENCY.includes(v)) next.maxConcurrency = v;
  }
  if (patch.downloadDir != null) next.downloadDir = String(patch.downloadDir);
  if (patch.maxSpeed != null) next.maxSpeed = Math.max(0, Number(patch.maxSpeed) || 0);
  if (patch.timeoutSec != null) next.timeoutSec = Math.max(1, Number(patch.timeoutSec) || 60);
  if (patch.retries != null) next.retries = Math.max(0, Number(patch.retries) || 0);
  if (patch.theme != null && ['light', 'dark', 'system'].includes(patch.theme)) next.theme = patch.theme;

  db.setSetting('defaultQuality', next.defaultQuality);
  db.setSetting('defaultFormat', next.defaultFormat);
  db.setSetting('maxConcurrency', String(next.maxConcurrency));
  db.setSetting('downloadDir', next.downloadDir);
  db.setSetting('maxSpeed', String(next.maxSpeed));
  db.setSetting('timeoutSec', String(next.timeoutSec));
  db.setSetting('retries', String(next.retries));
  db.setSetting('theme', next.theme);

  return next;
}
