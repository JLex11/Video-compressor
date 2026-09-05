import React from 'react';
import { Cpu, HardDrive, Sparkles, Zap } from 'lucide-react';
import { BatchStats, CodecInfo } from '../types';
import { formatBytes } from '../utils/formatters';

interface HeaderProps {
  codecInfo: CodecInfo;
  stats: BatchStats;
}

export const Header: React.FC<HeaderProps> = ({ codecInfo, stats }) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
                Optimizador de Video Rápido
              </h1>
              <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                GPU Fast
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Compresión por lotes simultánea sin pérdida perceptible de calidad
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          {/* Savings summary pill */}
          {stats.completedFiles > 0 && stats.totalBytesSaved > 0 && (
            <div
              id="batch-savings-badge"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 animate-in fade-in"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Espacio ahorrado:</span>
              <strong className="font-semibold text-emerald-200">
                {formatBytes(stats.totalBytesSaved)}
              </strong>
              <span className="text-[10px] bg-emerald-900/60 px-1.5 py-0.5 rounded-full font-bold">
                -{stats.overallRatio}%
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
