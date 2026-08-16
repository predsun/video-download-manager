import { Badge } from './ui/Badge';
import { STATUS_META } from '../lib/utils';
import type { TaskStatus } from '../types';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.waiting;
  return (
    <Badge className={meta.badge}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  );
}
