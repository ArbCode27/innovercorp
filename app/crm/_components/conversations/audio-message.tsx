"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { CRM_SURFACES } from "../../_lib/crm-theme";

interface AudioMessageProps {
  src: string;
  caption?: string;
  isOutgoing: boolean;
}

const formatAudioTime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0:00";

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
};

export const AudioMessage = ({ src, caption, isOutgoing }: AudioMessageProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const trimmedCaption = caption?.trim();
  const visibleCaption =
    trimmedCaption && trimmedCaption.toLowerCase() !== "audio" ? trimmedCaption : "";
  const audioLabel = trimmedCaption
    ? `Mensaje de audio: ${trimmedCaption}`
    : "Mensaje de audio";
  const playButtonClassName = isOutgoing
    ? "bg-white text-blue-700 hover:bg-blue-50 focus-visible:ring-white/70"
    : "bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-400";
  const durationLabel = duration ? formatAudioTime(duration) : "--:--";

  const handleTogglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }

      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;

    if (!audio) return;

    setDuration(audio.duration);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;

    if (!audio) return;

    setCurrentTime(audio.currentTime);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);

    if (!audio) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleAudioEnded = () => {
    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = 0;
    }

    setIsPlaying(false);
    setCurrentTime(0);
  };

  return (
    <div className="flex w-[min(19rem,72vw)] flex-col gap-2">
      <audio
        ref={audioRef}
        className="sr-only"
        preload="metadata"
        src={src}
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}>
        Tu navegador no soporta la reproducción de audio.
      </audio>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`flex size-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#0f1117] ${playButtonClassName}`}
          onClick={handleTogglePlayback}
          aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}>
          {isPlaying ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 size-4" aria-hidden="true" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-80">
              <Volume2 className="size-3.5" aria-hidden="true" />
              Audio
            </span>
            <span className="font-mono text-[11px] opacity-75">
              {formatAudioTime(currentTime)} / {durationLabel}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.01"
            value={duration ? currentTime : 0}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-white disabled:cursor-not-allowed disabled:opacity-60 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            onChange={handleSeek}
            disabled={!duration}
            aria-label={audioLabel}
          />
        </div>
      </div>

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
