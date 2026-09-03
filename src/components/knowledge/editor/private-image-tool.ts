import type {
  BlockTool,
  BlockToolConstructorOptions,
} from "@editorjs/editorjs";
import { uploadKnowledgeImage, type EditorImageUpload } from "@/lib/upload";
import { fileProxyUrl } from "./shared";

export interface PrivateImageData {
  file: { url: string; id: string };
  caption?: string;
}

/** Тексты берём из редактора (i18n) — чтобы тул не тянул next-intl */
export interface PrivateImageConfig {
  labels: {
    select: string;
    caption: string;
    tooBig: string;
    badType: string;
    failed: string;
  };
  /** Загрузчик картинки (БЗ — приватно, «Обновления» — публично) */
  uploader?: (file: File) => Promise<EditorImageUpload>;
  onError?: (message: string) => void;
}

const IMAGE_ICON =
  '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150.242V79c0-18.778-15.222-34-34-34H79c-18.778 0-34 15.222-34 34v42.264l67.179-44.192 80.35 63.143-45.4 39.15 63.94 60.15-16.29 16.29-38.19-38.19-25.16 25.16 30.35 30.35H79c-18.778 0-34-15.222-34-34v-38.68l67.179-44.19 80.35 63.14 45.4-39.15z"/></svg>';

/**
 * Кастомный image-блок Editor.js для приватных картинок БЗ.
 * В data хранится канонический `/files/:id`, показ — через прокси.
 */
export class PrivateImageTool implements BlockTool {
  private data: PrivateImageData;
  private readonly config: PrivateImageConfig;
  private wrapper: HTMLElement | null = null;

  static get toolbox() {
    return { title: "Картинка", icon: IMAGE_ICON };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({
    data,
    config,
  }: BlockToolConstructorOptions<PrivateImageData, PrivateImageConfig>) {
    this.data =
      data && (data as PrivateImageData).file
        ? (data as PrivateImageData)
        : { file: { url: "", id: "" } };
    this.config = config as PrivateImageConfig;
  }

  private fail(message: string) {
    this.config.onError?.(message);
  }

  private renderFilled() {
    if (!this.wrapper) return;
    this.wrapper.innerHTML = "";

    const img = document.createElement("img");
    img.src = fileProxyUrl(this.data.file.url);
    img.className = "kb-image__img";
    img.alt = this.data.caption ?? "";
    this.wrapper.appendChild(img);

    const caption = document.createElement("div");
    caption.contentEditable = "true";
    caption.className = "kb-image__caption";
    caption.dataset.placeholder = this.config.labels.caption;
    caption.innerHTML = this.data.caption ?? "";
    caption.addEventListener("input", () => {
      this.data.caption = caption.innerHTML;
    });
    this.wrapper.appendChild(caption);
  }

  private async pick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (this.wrapper) this.wrapper.classList.add("kb-image--loading");
      try {
        const upload = this.config.uploader ?? uploadKnowledgeImage;
        const res = await upload(file);
        this.data = { file: res.file, caption: this.data.caption };
        this.renderFilled();
      } catch (e) {
        const code = (e as { code?: string })?.code;
        this.fail(
          code === "ER502"
            ? this.config.labels.tooBig
            : code === "ER501"
              ? this.config.labels.badType
              : this.config.labels.failed
        );
      } finally {
        this.wrapper?.classList.remove("kb-image--loading");
      }
    };
    input.click();
  }

  private renderEmpty() {
    if (!this.wrapper) return;
    this.wrapper.innerHTML = "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kb-image__select";
    button.textContent = this.config.labels.select;
    button.addEventListener("click", () => void this.pick());
    this.wrapper.appendChild(button);
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "kb-image";
    if (this.data.file.url) this.renderFilled();
    else this.renderEmpty();
    return this.wrapper;
  }

  save(): PrivateImageData {
    return this.data;
  }

  validate(data: PrivateImageData): boolean {
    return !!data.file?.url;
  }
}
