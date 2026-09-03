"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type EditorJS from "@editorjs/editorjs";
import type { OutputData } from "@editorjs/editorjs";
import type { EditorJsData } from "@/lib/api";
import type { EditorImageUpload } from "@/lib/upload";
import { PrivateImageTool } from "./private-image-tool";
import "./editor.css";

export interface BlockEditorHandle {
  /** Текущий документ Editor.js (для сохранения) */
  save: () => Promise<EditorJsData>;
}

/**
 * Блочный редактор Базы знаний (Editor.js). Client-only: инструменты и ядро
 * грузятся динамически в effect (никакого window на SSR). Наружу — метод save().
 */
export const BlockEditor = forwardRef<
  BlockEditorHandle,
  {
    initialData?: EditorJsData;
    placeholder?: string;
    /** Загрузчик картинок (по умолчанию — приватный, для БЗ) */
    uploadImage?: (file: File) => Promise<EditorImageUpload>;
  }
>(function BlockEditor({ initialData, placeholder, uploadImage }, ref) {
  const t = useTranslations("Knowledge.editor");
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | null>(null);

  useImperativeHandle(ref, () => ({
    async save() {
      const editor = editorRef.current;
      if (!editor) return { blocks: [] };
      return (await editor.save()) as EditorJsData;
    },
  }));

  useEffect(() => {
    let destroyed = false;
    let instance: EditorJS | null = null;

    void (async () => {
      const [
        { default: EditorJSCtor },
        { default: Header },
        { default: List },
        { default: Quote },
        { default: CodeTool },
        { default: Table },
        { default: Delimiter },
        { default: Marker },
        { default: InlineCode },
      ] = await Promise.all([
        import("@editorjs/editorjs"),
        import("@editorjs/header"),
        import("@editorjs/list"),
        import("@editorjs/quote"),
        import("@editorjs/code"),
        import("@editorjs/table"),
        import("@editorjs/delimiter"),
        import("@editorjs/marker"),
        import("@editorjs/inline-code"),
      ]);
      if (destroyed || !holderRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools: Record<string, any> = {
        header: {
          class: Header,
          inlineToolbar: true,
          config: { levels: [2, 3, 4], defaultLevel: 2 },
        },
        list: {
          class: List,
          inlineToolbar: true,
          config: { defaultStyle: "unordered" },
        },
        quote: { class: Quote, inlineToolbar: true },
        code: CodeTool,
        table: { class: Table, inlineToolbar: true },
        delimiter: Delimiter,
        marker: { class: Marker, shortcut: "CMD+SHIFT+M" },
        inlineCode: { class: InlineCode, shortcut: "CMD+SHIFT+C" },
        image: {
          class: PrivateImageTool,
          config: {
            labels: {
              select: t("imageSelect"),
              caption: t("imageCaption"),
              tooBig: t("imageTooBig"),
              badType: t("imageBadType"),
              failed: t("imageFailed"),
            },
            uploader: uploadImage,
            onError: (m: string) => toast.error(m),
          },
        },
      };

      const editor = new EditorJSCtor({
        holder: holderRef.current,
        data:
          initialData && initialData.blocks?.length
            ? (initialData as OutputData)
            : undefined,
        placeholder: placeholder ?? t("placeholder"),
        minHeight: 160,
        tools,
      });
      instance = editor;
      editorRef.current = editor;

      try {
        await editor.isReady;
      } catch {
        // ядро не поднялось — оставим пустой холдер
      }
      if (destroyed) {
        try {
          editor.destroy();
        } catch {
          // no-op
        }
        editorRef.current = null;
      }
    })();

    return () => {
      destroyed = true;
      const editor = instance;
      if (editor) {
        editor.isReady
          .then(() => {
            try {
              editor.destroy();
            } catch {
              // no-op
            }
          })
          .catch(() => {});
      }
      if (editorRef.current === instance) editorRef.current = null;
    };
    // Инициализируем один раз; данные передаются в момент старта.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holderRef} className="kb-editor" />;
});
