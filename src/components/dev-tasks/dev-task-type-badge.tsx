import { Badge } from "@/components/ui/badge";
import type { DevTaskType } from "@/lib/api";

/**
 * Бейдж типа задачи. Тип задачи в списке приходит slug'ом — резолвим его через
 * карту slug→DevTaskType. Тон из type.color (если задан), иначе нейтральный
 * акцент. Неизвестный slug рендерим как нейтральный бейдж с самим slug'ом.
 */
export function DevTaskTypeBadge({
  slug,
  types,
}: {
  slug: string | null | undefined;
  types: Map<string, DevTaskType>;
}) {
  if (!slug) return null;
  const type = types.get(slug);

  if (!type) {
    return (
      <Badge variant="secondary" className="bg-secondary text-muted-foreground">
        {slug}
      </Badge>
    );
  }

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
