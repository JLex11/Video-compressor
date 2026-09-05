/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  FolderArchive,
  Info,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  BatchStats,
  CodecInfo,
  OptimizationSettings,
  QueueItem,
} from './types';
import { detectCodecSupport } from './utils/codecSupport';
import { PRESETS } from './utils/presets';
import { formatBytes } from './utils/formatters';
import { extractVideoMetadata, optimizeVideo } from './services/videoOptimizer';
import { downloadSingleFile, exportAllAsZip } from './services/zipExporter';

import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { PresetSelector } from './components/PresetSelector';
import { BatchControls } from './components/BatchControls';
import { VideoCard } from './components/VideoCard';
import { ComparisonModal } from './components/ComparisonModal';

export default function App() {
  const [codecInfo, setCodecInfo] = useState<CodecInfo>({
    mp4Supported: true,
    webmSupported: true,
    vp9Supported: true,
    av1Supported: false,
    h264Supported: true,
    hardwareAccelerated: true,
  });

  const [items, setItems] = useState<QueueItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<OptimizationSettings>(
    PRESETS[0].settings // 'fast' preset default
  );

  const [concurrency, setConcurrency] = useState<number>(2);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<number>(0);
  const [isAnalyzingFiles, setIsAnalyzingFiles] = useState<boolean>(false);

  const [comparisonItem, setComparisonItem] = useState<QueueItem | null>(null);

  // References for abort controllers & queue processing loop
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isProcessingRef = useRef<boolean>(false);
  isProcessingRef.current = isProcessing;

  const itemsRef = useRef<QueueItem[]>(items);
  itemsRef.current = items;

  const concurrencyRef = useRef<number>(concurrency);
  concurrencyRef.current = concurrency;

  // Detect codecs on mount
  useEffect(() => {
    const info = detectCodecSupport();
    setCodecInfo(info);
  }, []);

  // Compute batch statistics
  const stats: BatchStats = useMemo(() => {
    const totalFiles = items.length;
    const completedItems = items.filter((i) => i.status === 'completed');
    const completedFiles = completedItems.length;
    const inProgressFiles = items.filter((i) => i.status === 'processing').length;

    const totalOriginalBytes = items.reduce((acc, i) => acc + i.metadata.originalSize, 0);
    const completedOrigBytes = completedItems.reduce((acc, i) => acc + i.metadata.originalSize, 0);
    const totalOptimizedBytes = completedItems.reduce(
      (acc, i) => acc + (i.optimizedSize || 0),
      0
    );
    const totalBytesSaved = Math.max(0, completedOrigBytes - totalOptimizedBytes);

    const overallRatio =
      completedOrigBytes > 0
        ? Math.round((totalBytesSaved / completedOrigBytes) * 100)
        : 0;

    return {
      totalFiles,
      completedFiles,
      inProgressFiles,
      totalOriginalBytes,
      totalOptimizedBytes,
      totalBytesSaved,
      overallRatio,
    };
  }, [items]);

  // Handle files added via drag & drop or file dialog
  const handleFilesSelected = async (files: File[]) => {
    setIsAnalyzingFiles(true);

    const newQueueItems: QueueItem[] = [];

    for (const file of files) {
      try {
        const metadata = await extractVideoMetadata(file);
        const item: QueueItem = {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          metadata,
          settings: { ...globalSettings },
          status: 'idle',
          progress: 0,
        };
        newQueueItems.push(item);
      } catch (err: any) {
        console.error('Error analyzing video:', err);
      }
    }

    if (newQueueItems.length > 0) {
      setItems((prev) => [...prev, ...newQueueItems]);
    }

    setIsAnalyzingFiles(false);
  };

  // Run optimization worker on a specific item
  const processItem = async (itemId: string) => {
    const currentItem = itemsRef.current.find((i) => i.id === itemId);
    if (!currentItem || currentItem.status === 'completed') return;

    const abortController = new AbortController();
    abortControllersRef.current.set(itemId, abortController);

    // Update status to processing
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: 'processing', progress: 0, startTime: Date.now() }
          : i
      )
    );

    try {
      const result = await optimizeVideo(
        currentItem.file,
        currentItem.metadata,
        currentItem.settings,
        (progress, currentFps) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    progress,
                    processingFps: currentFps,
                  }
                : i
            )
          );
        },
        abortController.signal
      );

      // Successfully finished
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'completed',
                progress: 100,
                resultBlob: result.blob,
                resultUrl: result.url,
                optimizedSize: result.optimizedSize,
                compressionRatio: result.compressionRatio,
                finishTime: Date.now(),
              }
            : i
        )
      );
    } catch (err: any) {
      if (abortController.signal.aborted) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, status: 'cancelled', progress: 0 } : i
          )
        );
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  status: 'error',
                  progress: 0,
                  error: err?.message || 'Error procesando video',
                }
              : i
          )
        );
      }
    } finally {
      abortControllersRef.current.delete(itemId);
      // Trigger next item in the batch queue if batch processing is active
      scheduleNextBatchItem();
    }
  };

  // Dispatch next items according to concurrency limit
  const scheduleNextBatchItem = useCallback(() => {
    if (!isProcessingRef.current) return;

    const currentActive = itemsRef.current.filter((i) => i.status === 'processing').length;
    const availableSlots = concurrencyRef.current - currentActive;

    if (availableSlots <= 0) return;

    const pendingItems = itemsRef.current.filter(
      (i) => i.status === 'idle' || i.status === 'queued'
    );

    if (pendingItems.length === 0) {
      if (currentActive === 0) {
        setIsProcessing(false);
      }
      return;
    }

    const itemsToStart = pendingItems.slice(0, availableSlots);
    for (const item of itemsToStart) {
      processItem(item.id);
    }
  }, []);

  // Start all batch
  const handleStartAll = () => {
    setIsProcessing(true);
    isProcessingRef.current = true;

    // Mark pending items as queued
    setItems((prev) =>
      prev.map((i) =>
        i.status === 'idle' || i.status === 'error' || i.status === 'cancelled'
          ? { ...i, status: 'queued' }
          : i
      )
    );

    setTimeout(() => {
      scheduleNextBatchItem();
    }, 50);
  };

  // Pause batch
  const handlePauseAll = () => {
    setIsProcessing(false);
    isProcessingRef.current = false;
  };

  // Single item start
  const handleStartSingle = (id: string) => {
    processItem(id);
  };

  // Single item cancel
  const handleCancelSingle = (id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
    }
  };

  // Single item remove
  const handleRemoveSingle = (id: string) => {
    handleCancelSingle(id);
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.resultUrl) {
        URL.revokeObjectURL(target.resultUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all items
  const handleClearAll = () => {
    items.forEach((item) => {
      handleCancelSingle(item.id);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setItems([]);
    setIsProcessing(false);
  };

  // Clear completed items only
  const handleClearCompleted = () => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.status === 'completed' && item.resultUrl) {
          URL.revokeObjectURL(item.resultUrl);
        }
      });
      return prev.filter((item) => item.status !== 'completed');
    });
  };

  // Apply current global settings to all items in queue
  const handleApplySettingsToAll = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.status !== 'completed' && i.status !== 'processing'
          ? { ...i, settings: { ...globalSettings } }
          : i
      )
    );
  };

  // Update settings for an individual item
  const handleUpdateItemSettings = (id: string, newSettings: OptimizationSettings) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, settings: newSettings } : i))
    );
  };

  // Download all as ZIP
  const handleDownloadZip = async () => {
    if (isZipping) return;
    setIsZipping(true);
    setZipProgress(0);

    try {
      await exportAllAsZip(items, (progress) => {
        setZipProgress(progress);
      });
    } catch (err: any) {
      alert(err?.message || 'Error generando el archivo ZIP');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500 selection:text-zinc-950">
      {/* Top Header */}
      <Header codecInfo={codecInfo} stats={stats} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Preset & Output Format Selector */}
        <PresetSelector
          settings={globalSettings}
          onChange={(newSettings) => setGlobalSettings(newSettings)}
          onApplyToAll={items.length > 1 ? handleApplySettingsToAll : undefined}
          totalItemsInQueue={items.length}
        />

        {/* Drag & Drop Area */}
        <DropZone
          onFilesSelected={handleFilesSelected}
          isLoading={isAnalyzingFiles}
          totalInQueue={items.length}
        />

        {/* Batch Queue & Controls */}
        {items.length > 0 && (
          <section className="flex flex-col gap-4 animate-in fade-in">
            {/* Batch Controls Toolbar */}
            <BatchControls
              items={items}
              stats={stats}
              isProcessing={isProcessing}
              concurrency={concurrency}
              onConcurrencyChange={setConcurrency}
              onStartAll={handleStartAll}
              onPauseAll={handlePauseAll}
              onClearAll={handleClearAll}
              onClearCompleted={handleClearCompleted}
              onDownloadZip={handleDownloadZip}
              isZipping={isZipping}
              zipProgress={zipProgress}
            />

            {/* Video List */}
            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  onStartSingle={handleStartSingle}
                  onCancelSingle={handleCancelSingle}
                  onRemoveSingle={handleRemoveSingle}
                  onDownloadSingle={downloadSingleFile}
                  onOpenComparison={(itm) => setComparisonItem(itm)}
                  onUpdateSettings={handleUpdateItemSettings}
                />
              ))}
            </div>
          </section>
        )}

        {/* Feature Highlights / Tips Footer when list is empty - Flat minimal layout */}
        {items.length === 0 && (
          <div className="border-t border-zinc-800/60 pt-6 mt-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1.5 text-blue-400">
                <Zap className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-medium text-zinc-200">
                  Velocidad Acelerada por GPU
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Utiliza el motor de hardware de tu navegador para comprimir videos sin demoras ni subidas lentas a servidores.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1.5 text-cyan-400">
                <Layers className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-medium text-zinc-200">
                  Procesamiento por Lotes
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Añade múltiples videos a la vez y procésalos en paralelo. Descarga todo con un solo clic en un archivo ZIP ordenado.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-medium text-zinc-200">
                  Compresión sin Pérdida
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bitrate optimizado que reduce hasta un 80% el tamaño manteniendo la nitidez de imagen y audio nítido.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Comparison Modal */}
      {comparisonItem && (
        <ComparisonModal
          item={comparisonItem}
          onClose={() => setComparisonItem(null)}
          onDownload={downloadSingleFile}
        />
      )}
    </div>
  );
}
