export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'audio-wav';

export type ResolutionPreset = 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' | '360p';

export type FrameratePreset = 'original' | '60' | '30' | '24' | '15';

export type OptimizationPresetId =
  | 'fast'
  | 'compact'
  | 'target_size'
  | 'social'
  | 'high_quality'
  | 'custom';

export interface OptimizationSettings {
  presetId: OptimizationPresetId;
  format: ExportFormat;
  resolution: ResolutionPreset;
  fps: FrameratePreset;
  videoBitrateKbps: number; // 0 = automatic
  audioBitrateKbps: number; // 0 = mute, 64, 128, 192
  removeAudio: boolean;
  targetSizeMB?: number;
  speedMultiplier: number; // 1x, 2x, 4x
}

export interface VideoMetadata {
  name: string;
  originalSize: number; // in bytes
  type: string;
  duration: number; // in seconds
  width: number;
  height: number;
  thumbnailUrl: string;
}

export type ProcessingStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface QueueItem {
  id: string;
  file: File;
  metadata: VideoMetadata;
  settings: OptimizationSettings;
  status: ProcessingStatus;
  progress: number; // 0 - 100
  processingFps?: number;
  estimatedTimeLeft?: number; // seconds
  resultBlob?: Blob;
  resultUrl?: string;
  optimizedSize?: number;
  compressionRatio?: number; // e.g. 74.2 (%)
  error?: string;
  durationProcessed?: number;
  startTime?: number;
  finishTime?: number;
}

export interface BatchStats {
  totalFiles: number;
  completedFiles: number;
  inProgressFiles: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  totalBytesSaved: number;
  overallRatio: number;
}

export interface CodecInfo {
  mp4Supported: boolean;
  webmSupported: boolean;
  vp9Supported: boolean;
  av1Supported: boolean;
  h264Supported: boolean;
  hardwareAccelerated: boolean;
}
