import { Badge } from "@/components/ui/badge";

/** Бейдж типа документа: тон из type.color (если задан), иначе нейтральный акцент */
export function DocumentTypeBadge({
  type,
}: {
  type: { name: string; color?: string | null };
}) {
  if (type.color) {
    return (
      <Badge
        variant="secondary"
        className="border-transparent"
        style={{ backgroundColor: `${type.color}1a`, color: type.color }}
      >
        {type.name}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-accent-light text-primary">
      {type.name}
    </Badge>
  );
}
