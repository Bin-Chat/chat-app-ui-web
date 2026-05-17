import { useState, useRef, useEffect, useCallback } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';

interface VoiceMessageProps {
  url: string;
  duration?: number;
  isSelf?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Renders a voice message bubble with play/pause control and a scrubable progress bar.
 */
export default function VoiceMessage({ url, duration = 0, isSelf = false }: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };
    audio.ontimeupdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  }, []);

  const bubbleBg = isSelf ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800';
  const barBg = isSelf ? 'bg-white/30' : 'bg-gray-300';
  const barFill = isSelf ? 'bg-white' : 'bg-blue-500';
  const btnStyle = isSelf
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-blue-500 hover:bg-blue-600 text-white';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-2xl min-w-[180px] max-w-[280px] ${bubbleBg}`}
    >
      <button
        onClick={togglePlay}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${btnStyle}`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="flex flex-col flex-1 gap-1 min-w-0">
        <div
          className={`h-1.5 rounded-full cursor-pointer ${barBg}`}
          onClick={handleSeek}
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${barFill}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs opacity-70">
          <Volume2 size={10} />
          <span>{formatTime(isPlaying || progress > 0 ? currentTime : totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}
