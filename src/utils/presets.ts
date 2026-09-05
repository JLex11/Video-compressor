import { OptimizationPresetId, OptimizationSettings, ResolutionPreset } from '../types';

export interface PresetDefinition {
  id: OptimizationPresetId;
  name: string;
  tagline: string;
  badge: string;
  iconName: string;
  settings: OptimizationSettings;
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'fast',
    name: 'Ultra Rápido',
    tagline: 'Compresión acelerada por GPU sin pérdida visual perceptible',
    badge: 'Recomendado',
    iconName: 'Zap',
    settings: {
      presetId: 'fast',
      format: 'mp4',
      resolution: 'original',
      fps: 'original',
      videoBitrateKbps: 0, // Auto calculated based on resolution
      audioBitrateKbps: 128,
      removeAudio: false,
      speedMultiplier: 1,
    },
  },
  {
    id: 'compact',
    name: 'Máxima Compresión',
    tagline: 'Ahorro extremo de 75% a 90% del tamaño original',
    badge: 'Mayor Ahorro',
    iconName: 'Minimize2',
    settings: {
      presetId: 'compact',
      format: 'mp4',
      resolution: '720p',
      fps: '30',
      videoBitrateKbps: 950,
      audioBitrateKbps: 96,
      removeAudio: false,
      speedMultiplier: 1,
    },
  },
  {
    id: 'target_size',
    name: 'Tamaño Objetivo',
    tagline: 'Ajuste exacto para Discord (8MB), WhatsApp (16MB) o Email',
    badge: 'Límite Exacto',
    iconName: 'Target',
    settings: {
      presetId: 'target_size',
      format: 'mp4',
      resolution: 'original',
      fps: 'original',
      videoBitrateKbps: 0, // dynamic
      audioBitrateKbps: 96,
      removeAudio: false,
      targetSizeMB: 16,
      speedMultiplier: 1,
    },
  },
  {
    id: 'social',
    name: 'Redes Sociales & Web',
    tagline: '1080p balanceado para TikTok, Instagram Reels y YouTube Shorts',
    badge: 'Social Media',
    iconName: 'Share2',
    settings: {
      presetId: 'social',
      format: 'mp4',
      resolution: '1080p',
      fps: '30',
      videoBitrateKbps: 2600,
      audioBitrateKbps: 128,
      removeAudio: false,
      speedMultiplier: 1,
    },
  },
  {
    id: 'high_quality',
    name: 'Visualmente Sin Pérdida',
    tagline: 'Conserva fidelidad máxima con bitrate superior y audio cristalino',
    badge: 'Pro Quality',
    iconName: 'Sparkles',
    settings: {
      presetId: 'high_quality',
      format: 'mp4',
      resolution: 'original',
      fps: 'original',
      videoBitrateKbps: 5200,
      audioBitrateKbps: 192,
      removeAudio: false,
      speedMultiplier: 1,
    },
  },
  {
    id: 'custom',
    name: 'Personalizado',
    tagline: 'Configuración manual de bitrate, resolución, FPS y pistas',
    badge: 'Avanzado',
    iconName: 'Sliders',
    settings: {
      presetId: 'custom',
      format: 'mp4',
      resolution: 'original',
      fps: 'original',
      videoBitrateKbps: 1800,
      audioBitrateKbps: 128,
      removeAudio: false,
      speedMultiplier: 1,
    },
  },
];

export function getResolutionDimensions(
  origW: number,
  origH: number,
  preset: ResolutionPreset
): { width: number; height: number } {
  if (preset === 'original') {
    // Keep original, but ensure even dimensions for hardware video encoders
    return {
      width: origW % 2 === 0 ? origW : origW - 1,
      height: origH % 2 === 0 ? origH : origH - 1,
    };
  }

  const aspectRatio = origW / origH;
  let targetH = 1080;

  switch (preset) {
    case '4k':
      targetH = 2160;
      break;
    case '2k':
      targetH = 1440;
      break;
    case '1080p':
      targetH = 1080;
      break;
    case '720p':
      targetH = 720;
      break;
    case '480p':
      targetH = 480;
      break;
    case '360p':
      targetH = 360;
      break;
  }

  // If original is smaller than target, don't upscale
  if (origH <= targetH && origW <= targetH * aspectRatio) {
    return {
      width: origW % 2 === 0 ? origW : origW - 1,
      height: origH % 2 === 0 ? origH : origH - 1,
    };
  }

  let calculatedW = Math.round(targetH * aspectRatio);
  // Guarantee even dimensions
  if (calculatedW % 2 !== 0) calculatedW -= 1;
  let calculatedH = targetH;
  if (calculatedH % 2 !== 0) calculatedH -= 1;

  return { width: calculatedW, height: calculatedH };
}

export function estimateOptimalBitrate(width: number, height: number, fps: number = 30): number {
  const pixels = width * height;
  if (pixels >= 3840 * 2160) return 10000; // 4K
  if (pixels >= 2560 * 1440) return 5500;  // 2K
  if (pixels >= 1920 * 1080) return 2200;  // 1080p
  if (pixels >= 1280 * 720) return 1100;   // 720p
  if (pixels >= 854 * 480) return 600;     // 480p
  return 400; // 360p
}
