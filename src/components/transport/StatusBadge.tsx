import { Badge } from "@/components/ui/Badge";
import { humanize, statusTone } from "@/lib/transport/vocabulary";

/** Status pill: the text label carries the meaning; colour only reinforces. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{humanize(status)}</Badge>;
}
