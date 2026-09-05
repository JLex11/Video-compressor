import { ExportFormat } from '../types';

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const hours = Math.floor(mins / 60);

  if (hours > 0) {
    const remMins = mins % 60;
    return `${hours}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatBitrate(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${Math.round(kbps)} kbps`;
}

/**
 * Calculates video bitrate given target size in Megabytes and video duration in seconds.
 * Accounts for audio bitrate and container overhead.
 */
export function calculateTargetBitrate(
  targetSizeMB: number,
  durationSeconds: number,
  includeAudio: boolean = true,
  audioBitrateKbps: number = 96
): number {
  if (!durationSeconds || durationSeconds <= 0) return 1500;
  
  // 1 MB = 8192 kilobits. Keep 5% safety margin for container headers/metadata
  const totalKilobits = targetSizeMB * 8192 * 0.95;
  const totalBitrateKbps = totalKilobits / durationSeconds;

  const effectiveAudioKbps = includeAudio ? audioBitrateKbps : 0;
  const videoBitrateKbps = Math.max(150, Math.floor(totalBitrateKbps - effectiveAudioKbps));
  
  return videoBitrateKbps;
}

export function getFilenameWithoutExt(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.substring(0, lastDot);
}

export function generateOutputFilename(originalName: string, format: ExportFormat): string {
  const baseName = getFilenameWithoutExt(originalName);
  const extMap: Record<ExportFormat, string> = {
    mp4: 'mp4',
    webm: 'webm',
    gif: 'gif',
    'audio-wav': 'wav',
  };
  return `${baseName}_opt.${extMap[format]}`;
}
