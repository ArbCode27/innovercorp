import { CRM_SURFACES } from "../../_lib/crm-theme";

interface VideoMessageProps {
  src: string;
  caption?: string;
  isOutgoing: boolean;
}

const GENERIC_CAPTIONS = new Set(["video", "vídeo"]);

export const VideoMessage = ({ src, caption, isOutgoing }: VideoMessageProps) => {
  const trimmedCaption = caption?.trim();
  const visibleCaption =
    trimmedCaption && !GENERIC_CAPTIONS.has(trimmedCaption.toLowerCase())
      ? trimmedCaption
      : "";
  const ariaLabel = visibleCaption || "Video enviado en la conversación";

  return (
    <div className="flex flex-col gap-2">
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-80 w-auto max-w-[min(19rem,72vw)] rounded-xl bg-black object-contain sm:max-w-80"
        aria-label={ariaLabel}>
        Tu navegador no puede reproducir este video.
      </video>

      {visibleCaption ? (
        <p
          className={`whitespace-pre-wrap break-words text-xs leading-relaxed ${
            isOutgoing ? "text-blue-50" : CRM_SURFACES.textSecondary
          }`}>
          {visibleCaption}
        </p>
      ) : null}
    </div>
  );
};
