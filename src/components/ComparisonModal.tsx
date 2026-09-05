import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Eye,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { QueueItem } from '../types';
import { formatBytes, formatDuration } from '../utils/formatters';

interface ComparisonModalProps {
  item: QueueItem | null;
  onClose: () => void;
  onDownload: (item: QueueItem) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  item,
  onClose,
  onDownload,
}) => {
  const origVideoRef = useRef<HTMLVideoElement>(null);
  const optVideoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [sliderPos, setSliderPos] = useState(50); // Split slider percentage
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const [originalUrl, setOriginalUrl] = useState<string>('');

  useEffect(() => {
    if (!item) return;

    const url = URL.createObjectURL(item.file);
    setOriginalUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [item]);

  if (!item || !item.resultUrl) return null;

  const handlePlayPause = () => {
    const orig = origVideoRef.current;
    const opt = optVideoRef.current;
    if (!orig || !opt) return;

    if (isPlaying) {
      orig.pause();
      opt.pause();
      setIsPlaying(false);
    } else {
      orig.play().catch(() => {});
      opt.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (origVideoRef.current) {
      setCurrentTime(origVideoRef.current.currentTime);
      if (!duration && origVideoRef.current.duration) {
        setDuration(origVideoRef.current.duration);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (origVideoRef.current) origVideoRef.current.currentTime = time;
    if (optVideoRef.current) optVideoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (origVideoRef.current) origVideoRef.current.muted = next;
    if (optVideoRef.current) optVideoRef.current.muted = next;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">
                Comparador Visual de Calidad: {item.metadata.name}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Inspección cuadro a cuadro sin pérdida perceptible
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  viewMode === 'split'
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Deslizador Dividido
              </button>
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lado a Lado
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Comparison Stage */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[300px] sm:min-h-[420px]">
          {viewMode === 'split' ? (
            /* Split Interactive Comparison Slider */
            <div className="relative w-full h-full max-h-[550px] aspect-video flex items-center justify-center select-none overflow-hidden">
              {/* Original Video (Background) */}
              <video
                ref={origVideoRef}
                src={originalUrl}
                playsInline
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />

              {/* Optimized Video (Foreground clipped by sliderPos) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
              >
                <video
                  ref={optVideoRef}
                  src={item.resultUrl}
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Split Line Divider & Handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-lg cursor-ew-resize z-20"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-lg font-bold text-[10px]">
                  ⬄
                </div>
              </div>

              {/* Invisible touch/drag slider overlay */}
              <input
                type="range"
                min={0}
                max={100}
                value={sliderPos}
                onChange={(e) => setSliderPos(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
              />

              {/* Floating Labels */}
              <div className="absolute top-3 left-4 z-10 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-sm border border-zinc-800 text-[11px] font-semibold text-zinc-200">
                Original ({formatBytes(item.metadata.originalSize)})
              </div>
              <div className="absolute top-3 right-4 z-10 px-2.5 py-1 rounded-md bg-emerald-950/80 backdrop-blur-sm border border-emerald-500/40 text-[11px] font-semibold text-emerald-300">
                Optimizado ({formatBytes(item.optimizedSize || 0)}) • -{item.compressionRatio}%
              </div>
            </div>
          ) : (
            /* Side by Side Mode */
            <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
              <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                <video
                  ref={origVideoRef}
                  src={originalUrl}
                  playsInline
                  muted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-zinc-300">
                  Original: {formatBytes(item.metadata.originalSize)}
                </span>
              </div>

              <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-emerald-500/30">
                <video
                  ref={optVideoRef}
                  src={item.resultUrl}
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] font-semibold border border-emerald-500/40">
                  Optimizado: {formatBytes(item.optimizedSize || 0)} (-{item.compressionRatio}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Video Playback Scrubber & Controls */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/90 flex flex-col gap-2">
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-400 w-10">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || item.metadata.duration || 100}
              step={0.05}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
            <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
              {formatDuration(duration || item.metadata.duration)}
            </span>
          </div>

          {/* Buttons Row & Metrics Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center font-bold transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-xl text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleSeek(0)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
                title="Reiniciar reproducción"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics pills */}
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-2">
                <span>{formatBytes(item.metadata.originalSize)}</span>
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <strong className="text-emerald-300 font-bold">
                  {formatBytes(item.optimizedSize || 0)}
                </strong>
                <span className="text-emerald-400 font-extrabold bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px]">
                  -{item.compressionRatio}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => onDownload(item)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                Descargar Optimizado
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
