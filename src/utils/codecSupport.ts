import { CodecInfo, ExportFormat } from '../types';

export function detectCodecSupport(): CodecInfo {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return {
      mp4Supported: false,
      webmSupported: false,
      vp9Supported: false,
      av1Supported: false,
      h264Supported: false,
      hardwareAccelerated: false,
    };
  }

  const mp4Types = [
    'video/mp4',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1',
  ];
  const mp4Supported = mp4Types.some((t) => MediaRecorder.isTypeSupported(t));

  const vp9Types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
  ];
  const vp9Supported = vp9Types.some((t) => MediaRecorder.isTypeSupported(t));

  const av1Types = [
    'video/webm;codecs=av01,opus',
    'video/webm;codecs=av01',
    'video/mp4;codecs=av01',
  ];
  const av1Supported = av1Types.some((t) => MediaRecorder.isTypeSupported(t));

  const h264Types = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=h264',
    'video/webm;codecs=avc1',
  ];
  const h264Supported = h264Types.some((t) => MediaRecorder.isTypeSupported(t));

  const webmSupported = MediaRecorder.isTypeSupported('video/webm') || vp9Supported;

  // Modern browsers with WebCodecs or hardware MediaRecorder
  const hasWebCodecs = typeof (window as any).VideoEncoder !== 'undefined';
  const hardwareAccelerated = hasWebCodecs || mp4Supported || vp9Supported;

  return {
    mp4Supported,
    webmSupported,
    vp9Supported,
    av1Supported,
    h264Supported,
    hardwareAccelerated,
  };
}

export function getBestMimeTypeForFormat(format: ExportFormat): { mimeType: string; container: string } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', container: 'webm' };
  }

  if (format === 'mp4') {
    const preferredMp4 = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    for (const type of preferredMp4) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, container: 'mp4' };
      }
    }
    // Fallback: If browser does not support raw MP4 recording directly (e.g. older Firefox),
    // use H.264 inside webm or VP9 which can be downloaded and played widely.
    if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
      return { mimeType: 'video/webm;codecs=h264,opus', container: 'webm' };
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      return { mimeType: 'video/webm;codecs=vp9,opus', container: 'webm' };
    }
    return { mimeType: 'video/webm', container: 'webm' };
  }

  if (format === 'webm') {
    const preferredWebm = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm',
    ];
    for (const type of preferredWebm) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, container: 'webm' };
      }
    }
    return { mimeType: 'video/webm', container: 'webm' };
  }

  return { mimeType: 'video/webm', container: 'webm' };
}
