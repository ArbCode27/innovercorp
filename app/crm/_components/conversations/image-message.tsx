import { ImageLightbox } from "./image-lightbox";

interface ImageMessageProps {
  src: string;
  caption?: string;
  isOutgoing: boolean;
}

const GENERIC_CAPTIONS = new Set(["imagen", "image"]);

export const ImageMessage = ({ src, caption }: ImageMessageProps) => {
  const trimmedCaption = caption?.trim();
  const visibleCaption =
    trimmedCaption && !GENERIC_CAPTIONS.has(trimmedCaption.toLowerCase())
      ? trimmedCaption
      : "";
  const altText = visibleCaption || "Imagen enviada en la conversación";

  return (
    <div className="flex flex-col gap-2">
      <ImageLightbox
        src={src}
        alt={altText}
        caption={visibleCaption || undefined}
      />
      {visibleCaption ? (
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed opacity-90">
          {visibleCaption}
        </p>
      ) : null}
    </div>
  );
};
