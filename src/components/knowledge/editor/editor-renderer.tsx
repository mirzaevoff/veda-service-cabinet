"use client";

import { Fragment, useMemo } from "react";
import DOMPurify from "dompurify";
import { Check } from "lucide-react";
import type { EditorJsBlock, EditorJsData } from "@/lib/api";
import { fileProxyUrl } from "./shared";
import { cn } from "@/lib/utils";

const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "s", "mark", "code", "a", "br"];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

/** Инлайн-HTML из блоков Editor.js — санитайз (staff-контент, но защищаемся) */
function inline(html: string | undefined) {
  const value = html ?? "";
  const clean =
    typeof window === "undefined"
      ? value.replace(/<[^>]*>/g, "")
      : DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR });
  return <span dangerouslySetInnerHTML={{ __html: clean }} />;
}

type ListItem = string | { content?: string; items?: ListItem[]; meta?: { checked?: boolean } };

function List({
  style,
  items,
}: {
  style: string;
  items: ListItem[];
}) {
  const checklist = style === "checklist";
  const ordered = style === "ordered";
  const Tag = (ordered ? "ol" : "ul") as "ol" | "ul";
  return (
    <Tag className={checklist ? "!list-none !pl-0" : undefined}>
      {items.map((item, i) => {
        const content = typeof item === "string" ? item : item.content ?? "";
        const children = typeof item === "string" ? undefined : item.items;
        const checked = typeof item === "string" ? false : !!item.meta?.checked;
        return (
          <li key={i} className={checklist ? "flex items-start gap-2 !my-1.5" : undefined}>
            {checklist && (
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
            )}
            <span className="min-w-0 flex-1">{inline(content)}</span>
            {children && children.length > 0 && (
              <List style={style} items={children} />
            )}
          </li>
        );
      })}
    </Tag>
  );
}

function Block({ block }: { block: EditorJsBlock }) {
  const d = block.data as Record<string, unknown>;
  switch (block.type) {
    case "header": {
      const level = Math.min(4, Math.max(2, Number(d.level) || 2));
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      return <Tag>{inline(String(d.text ?? ""))}</Tag>;
    }
    case "paragraph":
      return <p>{inline(String(d.text ?? ""))}</p>;
    case "list":
      return (
        <List
          style={String(d.style ?? "unordered")}
          items={(d.items as ListItem[]) ?? []}
        />
      );
    case "checklist":
      // старый формат чеклиста (если встретится)
      return (
        <List
          style="checklist"
          items={((d.items as { text?: string; checked?: boolean }[]) ?? []).map(
            (it) => ({ content: it.text, meta: { checked: it.checked } })
          )}
        />
      );
    case "quote":
      return (
        <blockquote>
          {inline(String(d.text ?? ""))}
          {d.caption ? (
            <cite className="mt-1 block text-xs not-italic text-muted-foreground">
              {inline(String(d.caption))}
            </cite>
          ) : null}
        </blockquote>
      );
    case "code":
      return (
        <pre>
          <code>{String(d.code ?? "")}</code>
        </pre>
      );
    case "delimiter":
      return <hr />;
    case "table": {
      const rows = (d.content as string[][]) ?? [];
      const withHeadings = !!d.withHeadings;
      return (
        <table>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) =>
                  withHeadings && ri === 0 ? (
                    <th key={ci}>{inline(cell)}</th>
                  ) : (
                    <td key={ci}>{inline(cell)}</td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "image": {
      const file = d.file as { url?: string } | undefined;
      if (!file?.url) return null;
      return (
        <figure className="my-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileProxyUrl(file.url)} alt={String(d.caption ?? "")} />
          {d.caption ? (
            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
              {inline(String(d.caption))}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    default:
      return null;
  }
}

/** Рендер документа Editor.js под дизайн-систему (read-only) */
export function EditorRenderer({
  content,
  className,
}: {
  content: EditorJsData | null | undefined;
  className?: string;
}) {
  const blocks = useMemo(() => content?.blocks ?? [], [content]);

  if (blocks.length === 0) return null;

  return (
    <div
      className={cn(
        "text-sm leading-6 text-foreground break-words",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_a]:text-primary [&_a]:underline hover:[&_a]:text-accent-bright",
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_mark]:rounded [&_mark]:bg-accent-light [&_mark]:px-0.5",
        "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-secondary [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        "[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
        "[&_th]:border [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5",
        "[&_hr]:my-5 [&_hr]:border-border",
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border",
        "[&_strong]:font-semibold",
        className
      )}
    >
      {blocks.map((block, i) => (
        <Fragment key={block.id ?? i}>
          <Block block={block} />
        </Fragment>
      ))}
    </div>
  );
}
