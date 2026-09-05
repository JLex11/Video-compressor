import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileVideo,
  Play,
  RotateCcw,
  Sliders,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { QueueItem } from '../types';
import { formatBitrate, formatBytes, formatDuration, generateOutputFilename } from '../utils/formatters';

interface VideoCardProps {
  item: QueueItem;
  onStartSingle: (id: string) => void;
  onCancelSingle: (id: string) => void;
  onRemoveSingle: (id: string) => void;
  onDownloadSingle: (item: QueueItem) => void;
  onOpenComparison: (item: QueueItem) => void;
  onUpdateSettings: (id: string, newSettings: QueueItem['settings']) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  item,
  onStartSingle,
  onCancelSingle,
  onRemoveSingle,
  onDownloadSingle,
  onOpenComparison,
  onUpdateSettings,
}) => {
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const { metadata, settings, status, progress } = item;

  const isCompleted = status === 'completed';
  const isProcessing = status === 'processing';
  const isError = status === 'error';

  return (
    <div
      id={`video-card-${item.id}`}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isProcessing
          ? 'border-cyan-500/50 bg-zinc-900/90 shadow-md shadow-cyan-500/5'
          : isCompleted
          ? 'border-emerald-500/40 bg-zinc-900/60'
          : isError
          ? 'border-rose-500/40 bg-zinc-900/60'
          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
      }`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
        {/* Thumbnail with duration overlay */}
        <div className="relative w-full sm:w-28 sm:h-20 aspect-video sm:aspect-auto rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800">
          {metadata.thumbnailUrl ? (
            <img
              src={metadata.thumbnailUrl}
              alt={metadata.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <FileVideo className="w-8 h-8" />
            </div>
          )}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono text-zinc-300 font-medium">
            {formatDuration(metadata.duration)}
          </span>
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-zinc-950/80 text-[9px] font-mono text-zinc-300 uppercase">
            {settings.format}
          </span>
        </div>

        {/* Video metadata and state */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className="text-xs sm:text-sm font-medium text-zinc-100 truncate"
              title={metadata.name}
            >
              {metadata.name}
            </h4>

            {/* Quick status pill */}
            <div className="flex-shrink-0">
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Completado (-{item.compressionRatio}%)
                </span>
              )}
              {isProcessing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  {progress}%
                </span>
              )}
              {status === 'queued' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  En cola
                </span>
              )}
              {isError && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" />
                  Error
                </span>
              )}
            </div>
          </div>

          {/* Details & size comparison */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-400 mb-2.5">
            <span>
              {metadata.width}x{metadata.height}
            </span>
            <span className="text-zinc-600">•</span>

            {/* Comparison pill */}
            {!isCompleted ? (
              <span className="text-zinc-300">
                Original: <strong>{formatBytes(metadata.originalSize)}</strong>
              </span>
            ) : (
              <div className="flex items-center gap-1.5 font-medium">
                <span className="line-through text-zinc-500 text-[11px]">
                  {formatBytes(metadata.originalSize)}
                </span>
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-bold">
                  {formatBytes(item.optimizedSize || 0)}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                  Ahorro: {formatBytes(metadata.originalSize - (item.optimizedSize || 0))}
                </span>
              </div>
            )}

            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-400 hidden sm:inline">
              Perfil: {settings.presetId}
            </span>
          </div>

          {/* Progress bar during processing */}
          {isProcessing && (
            <div className="w-full mb-2">
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-150 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-1 font-mono">
                <span>
                  {item.processingFps ? `${item.processingFps} FPS (acelerado)` : 'Procesando...'}
                </span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {/* Error explanation if failed */}
          {isError && (
            <p className="text-xs text-rose-400 mb-2">
              {item.error || 'Ocurrió un error al procesar el archivo.'}
            </p>
          )}
        </div>

        {/* Action buttons on the right */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/60">
          {/* If completed: Compare & Download */}
          {isCompleted && (
            <>
              <button
                type="button"
                id={`compare-btn-${item.id}`}
                onClick={() => onOpenComparison(item)}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5"
                title="Comparar calidad y detalles visuales lado a lado"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Comparar</span>
              </button>

              <button
                type="button"
                id={`download-single-btn-${item.id}`}
                onClick={() => onDownloadSingle(item)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                title="Descargar este archivo optimizado"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </>
          )}

          {/* If idle or error: Start single button */}
          {(status === 'idle' || isError) && (
            <button
              type="button"
              id={`start-single-btn-${item.id}`}
              onClick={() => onStartSingle(item.id)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5"
              title="Optimizar únicamente este video"
            >
              <Play className="w-3 h-3 fill-current text-emerald-400" />
              <span>Optimizar</span>
            </button>
          )}

          {/* If processing: Cancel */}
          {isProcessing && (
            <button
              type="button"
              id={`cancel-single-btn-${item.id}`}
              onClick={() => onCancelSingle(item.id)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1"
              title="Cancelar procesamiento"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          )}

          {/* Custom settings toggle for this specific file */}
          {!isProcessing && (
            <button
              type="button"
              id={`settings-toggle-${item.id}`}
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              className={`p-2 rounded-xl transition-colors ${
                showSettingsPopover
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
              }`}
              title="Ajustar parámetros específicos para este video"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {/* Delete item */}
          <button
            type="button"
            id={`remove-single-btn-${item.id}`}
            onClick={() => onRemoveSingle(item.id)}
            disabled={isProcessing}
            className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Quitar de la lista"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Individual Custom Settings Override */}
      {showSettingsPopover && !isProcessing && (
        <div className="bg-zinc-950 border-t border-zinc-800 p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Formato de salida
            </label>
            <select
              value={settings.format}
              onChange={(e) =>
                onUpdateSettings(item.id, {
                  ...settings,
                  format: e.target.value as any,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200"
            >
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
              <option value="gif">GIF Animado</option>
              <option value="audio-wav">Audio WAV</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Resolución
            </label>
            <select
              value={settings.resolution}
              onChange={(e) =>
                onUpdateSettings(item.id, {
                  ...settings,
                  resolution: e.target.value as any,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200"
            >
              <option value="original">Mantener Original</option>
              <option value="1080p">1080p Full HD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p SD</option>
              <option value="360p">360p Ultra compacto</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-4">
            <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeAudio}
                onChange={(e) =>
                  onUpdateSettings(item.id, {
                    ...settings,
                    removeAudio: e.target.checked,
                  })
                }
                className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0"
              />
              Silenciar
            </label>

            <button
              type="button"
              onClick={() => setShowSettingsPopover(false)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
