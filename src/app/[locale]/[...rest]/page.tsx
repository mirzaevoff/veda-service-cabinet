import { notFound } from "next/navigation";

/** Любой несуществующий путь внутри локали → фирменная 404 */
export default function CatchAllPage() {
  notFound();
}
