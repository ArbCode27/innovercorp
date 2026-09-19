"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  assertFacadeImageFile,
  FACADE_IMAGE_ACCEPT,
  FacadeImageError,
  pickImageFromDataTransfer,
} from "@/lib/facade-image";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";

export type FacadeChatImage = {
  messageId: number | null;
  mediaUrl: string;
  caption: string | null;
};

export type FacadeImageValue = {
  mediaUrl: string;
  messageId: number | null;
};

interface FacadeImageFieldProps {
  chatImages?: FacadeChatImage[];
  value: FacadeImageValue;
  onChange: (next: FacadeImageValue) => void;
  disabled?: boolean;
}

const EMPTY_VALUE: FacadeImageValue = { mediaUrl: "", messageId: null };

export const FacadeImageField = ({
  chatImages = [],
  value,
  onChange,
  disabled = false,
}: FacadeImageFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleClear = () => {
    onChange(EMPTY_VALUE);
  };

  const handleSelectChatImage = (image: FacadeChatImage) => {
    onChange({ mediaUrl: image.mediaUrl, messageId: image.messageId });
  };

  const handleUploadFile = useCallback(
    async (file: File | null) => {
      if (!file || disabled || isUploading) return;
      try {
        assertFacadeImageFile(file);
        setIsUploading(true);
        const url = await wisproCasoClient.uploadFacade(file);
        onChange({ mediaUrl: url, messageId: null });
      } catch (error) {
        toast.error(
          error instanceof FacadeImageError
            ? error.message
            : error instanceof Error
              ? error.message
              : "No se subió la foto de fachada",
        );
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [disabled, isUploading, onChange],
  );

  useEffect(() => {
    if (disabled) return;
    const handleWindowPaste = (event: globalThis.ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input:not([type=file]), textarea, [contenteditable=true]")) {
        return;
      }
      const file = pickImageFromDataTransfer(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void handleUploadFile(file);
    };
    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [disabled, handleUploadFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleUploadFile(event.target.files?.[0] || null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = pickImageFromDataTransfer(event.dataTransfer);
    void handleUploadFile(file);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
        Foto de fachada (se reenvía al técnico con el reporte)
      </p>

      {value.mediaUrl ? (
        <div className="relative overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.mediaUrl}
            alt="Fachada seleccionada"
            className="h-36 w-full object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute right-2 top-2"
            disabled={disabled || isUploading}
            aria-label="Quitar foto de fachada"
            onClick={handleClear}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {chatImages.length ? (
        <div className="grid grid-cols-3 gap-2">
          {chatImages.map((image) => {
            const selected = image.mediaUrl === value.mediaUrl;
            return (
              <button
                key={`${image.messageId}-${image.mediaUrl}`}
                type="button"
                disabled={disabled || isUploading}
                onClick={() => handleSelectChatImage(image)}
                aria-label="Elegir foto de fachada del chat"
                aria-pressed={selected}
                className={cn(
                  "overflow-hidden rounded-xl border-2",
                  selected ? "border-emerald-500" : "border-transparent",
                )}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.mediaUrl}
                  alt={image.caption || "Foto del chat"}
                  className="h-20 w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Subir o pegar foto de fachada"
        aria-disabled={disabled || isUploading}
        onClick={() => {
          if (disabled || isUploading) return;
          fileInputRef.current?.click();
        }}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isDragging ? "border-ring bg-accent" : "border-input bg-popover",
          (disabled || isUploading) && "cursor-not-allowed opacity-70",
        )}>
        {isUploading ? (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-foreground">
          {isUploading ? "Subiendo fachada..." : "Subir o pegar foto"}
        </p>
        <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
          JPG, PNG o WebP · máx. 5 MB · Ctrl+V
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={FACADE_IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={handleFileChange}
      />
    </div>
  );
};
