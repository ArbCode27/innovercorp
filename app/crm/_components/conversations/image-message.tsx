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
    <ImageLightbox src={src} alt={altText} caption={visibleCaption || undefined} />
  );
};
