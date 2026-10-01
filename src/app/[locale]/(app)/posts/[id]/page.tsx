"use client";

import { use } from "react";
import { PostEditor } from "@/components/posts/post-editor";

/** Редактор поста сайта */
export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PostEditor postId={id} />;
}
