import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FolderArchive,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { BatchStats, ProcessingStatus, QueueItem } from '../types';
import { formatBytes } from '../utils/formatters';

interface BatchControlsProps {
  items: QueueItem[];
  stats: BatchStats;
  isProcessing: boolean;
  concurrency: number;
  onConcurrencyChange: (val: number) => void;
  onStartAll: () => void;
  onPauseAll: () => void;
  onClearAll: () => void;
  onClearCompleted: () => void;
  onDownloadZip: () => void;
  isZipping: boolean;
  zipProgress: number;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  items,
  stats,
  isProcessing,
  concurrency,
  onConcurrencyChange,
  onStartAll,
  onPauseAll,
  onClearAll,
  onClearCompleted,
  onDownloadZip,
  isZipping,
  zipProgress,
}) => {
  const pendingCount = items.filter(
    (i) => i.status === 'idle' || i.status === 'queued' || i.status === 'error'
  ).length;

  const hasCompleted = stats.completedFiles > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left side: Overview counters */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-semibold text-zinc-100">
              Cola de Procesamiento por Lotes
            </span>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-mono font-medium">
              {items.length} {items.length === 1 ? 'video' : 'videos'}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Quick status tallies */}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {stats.completedFiles > 0 && (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {stats.completedFiles} listos
              </span>
            )}
            {stats.inProgressFiles > 0 && (
              <span className="flex items-center gap-1 text-cyan-400 font-medium animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                {stats.inProgressFiles} optimizando
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-zinc-400">
                {pendingCount} pendientes
              </span>
            )}
          </div>
        </div>

        {/* Right side: Concurrency selector & Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          {/* Concurrency Selector */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
            title="Cantidad de videos que se procesan a la vez aprovechando los núcleos del dispositivo"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400 hidden sm:inline">Simultáneos:</span>
            <select
              value={concurrency}
              onChange={(e) => onConcurrencyChange(parseInt(e.target.value))}
              disabled={isProcessing}
              className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value={1} className="bg-zinc-900 text-zinc-200">1 archivo (Bajo consumo)</option>
              <option value={2} className="bg-zinc-900 text-zinc-200">2 simultáneos (Recomendado)</option>
              <option value={3} className="bg-zinc-900 text-zinc-200">3 simultáneos (Rápido)</option>
              <option value={4} className="bg-zinc-900 text-zinc-200">4 simultáneos (Turbo)</option>
            </select>
          </div>

          {/* Start All / Pause Button */}
          {isProcessing ? (
            <button
              type="button"
              id="pause-batch-btn"
              onClick={onPauseAll}
              className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pausar Lote
            </button>
          ) : (
            <button
              type="button"
              id="start-batch-btn"
              onClick={onStartAll}
              disabled={pendingCount === 0}
              className={`px-4 py-2 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all ${
                pendingCount === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20 font-semibold cursor-pointer'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              Optimizar Todos ({pendingCount})
            </button>
          )}

          {/* Download All as ZIP button */}
          {hasCompleted && (
            <button
              type="button"
              id="download-zip-btn"
              onClick={onDownloadZip}
              disabled={isZipping}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/70 text-zinc-100 font-medium text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm"
              title="Descarga todos los videos optimizados empaquetados en un único archivo ZIP"
            >
              <FolderArchive className="w-4 h-4 text-emerald-400" />
              {isZipping ? (
                <span>Empaquetando ZIP ({zipProgress}%)...</span>
              ) : (
                <span>Descargar Todo (ZIP)</span>
              )}
            </button>
          )}

          {/* Clear Actions */}
          <div className="flex items-center">
            {stats.completedFiles > 0 && pendingCount > 0 && (
              <button
                type="button"
                id="clear-completed-btn"
                onClick={onClearCompleted}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                title="Quitar de la lista los videos ya completados"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              id="clear-all-btn"
              onClick={onClearAll}
              className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors"
              title="Vaciar toda la cola de videos"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
