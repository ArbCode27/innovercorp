"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string;
  alt: string;
  caption?: string;
  thumbClassName?: string;
}

export const ImageLightbox = ({
  src,
  alt,
  caption,
  thumbClassName,
}: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="block rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#0f1117]"
        aria-label="Ampliar imagen">
        <Image
          src={src}
          alt={alt}
          width={320}
          height={400}
          unoptimized
          className={cn(
            "max-h-80 w-auto max-w-[min(19rem,72vw)] rounded-2xl object-contain sm:max-w-80",
            thumbClassName,
          )}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[92vh] w-auto max-w-[min(96vw,80rem)] border-white/15 bg-zinc-950 p-3 text-white sm:max-w-[min(96vw,80rem)] [&_[data-slot=dialog-close]]:text-white"
          aria-label="Vista ampliada de la imagen">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">
            Imagen ampliada. Pulsa Escape o cerrar para volver al chat.
          </DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[80vh] w-auto max-w-full object-contain"
          />
          {caption ? (
            <p className="mt-2 text-center text-sm text-white/80">{caption}</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
