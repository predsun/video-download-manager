import { Badge } from './ui/Badge';
import { PLATFORMS, platformLabel } from '../lib/utils';

export function PlatformBadge({ platform }: { platform: string }) {
  const meta = PLATFORMS[platform];
  return <Badge className={meta?.color ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}>{platformLabel(platform)}</Badge>;
}
