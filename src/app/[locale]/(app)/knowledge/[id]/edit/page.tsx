"use client";

import { use } from "react";
import { ArticleEditor } from "@/components/knowledge/article-editor";

export default function EditArticleRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ArticleEditor articleId={id} />;
}
