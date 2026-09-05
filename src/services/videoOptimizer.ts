import { OptimizationSettings, VideoMetadata } from '../types';
import { calculateTargetBitrate } from '../utils/formatters';
import { estimateOptimalBitrate, getResolutionDimensions } from '../utils/presets';
import { getBestMimeTypeForFormat } from '../utils/codecSupport';
import { encodeGif, GifFrame } from './gifEncoder';
import { extractAudioWav } from './audioExtractor';

export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('No se pudo leer el archivo de video. Comprueba que el formato sea válido.'));
    };

    video.onloadedmetadata = () => {
      // Seek slightly into the video to capture a meaningful thumbnail instead of a black intro frame
      const seekTime = Math.min(1.0, video.duration > 1 ? 0.5 : 0.05);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        // Generate clean thumbnail
        const thumbCanvas = document.createElement('canvas');
        const aspect = width / height;
        const thumbWidth = 360;
        const thumbHeight = Math.round(thumbWidth / aspect);
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        }

        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
        const duration = isFinite(video.duration) ? video.duration : 0;

        cleanup();
        resolve({
          name: file.name,
          originalSize: file.size,
          type: file.type || 'video/mp4',
          duration,
          width,
          height,
          thumbnailUrl,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

export interface OptimizationResult {
  blob: Blob;
  url: string;
  optimizedSize: number;
  compressionRatio: number;
}

export async function optimizeVideo(
  file: File,
  metadata: VideoMetadata,
  settings: OptimizationSettings,
  onProgress: (percent: number, currentFps: number) => void,
  abortSignal?: AbortSignal
): Promise<OptimizationResult> {
  // 1. If format is Audio WAV:
  if (settings.format === 'audio-wav') {
    const audioBlob = await extractAudioWav(file, (p) => onProgress(p, 0));
    const url = URL.createObjectURL(audioBlob);
    const optimizedSize = audioBlob.size;
    const compressionRatio = Math.max(
      0,
      parseFloat(((1 - optimizedSize / metadata.originalSize) * 100).toFixed(1))
    );
    return { blob: audioBlob, url, optimizedSize, compressionRatio };
  }

  // 2. If format is Animated GIF:
  if (settings.format === 'gif') {
    return processVideoToGif(file, metadata, settings, onProgress, abortSignal);
  }

  // 3. Hardware Video Processing (MP4 / WebM):
  return processHardwareVideo(file, metadata, settings, onProgress, abortSignal);
}

async function processHardwareVideo(
  file: File,
  metadata: VideoMetadata,
  settings: OptimizationSettings,
  onProgress: (percent: number, currentFps: number) => void,
  abortSignal?: AbortSignal
): Promise<OptimizationResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.playsInline = true;
    video.muted = !!settings.removeAudio;

    // Resolution calculation
    const { width: targetWidth, height: targetHeight } = getResolutionDimensions(
      metadata.width,
      metadata.height,
      settings.resolution
    );

    // Frame rate
    let targetFps = 30;
    if (settings.fps === '60') targetFps = 60;
    else if (settings.fps === '30') targetFps = 30;
    else if (settings.fps === '24') targetFps = 24;
    else if (settings.fps === '15') targetFps = 15;
    else targetFps = 30;

    // Bitrate calculation
    let targetVideoBitrate: number;
    if (settings.presetId === 'target_size' && settings.targetSizeMB) {
      targetVideoBitrate =
        calculateTargetBitrate(
          settings.targetSizeMB,
          metadata.duration,
          !settings.removeAudio,
          settings.audioBitrateKbps || 96
        ) * 1000;
    } else if (settings.videoBitrateKbps > 0) {
      targetVideoBitrate = settings.videoBitrateKbps * 1000;
    } else {
      targetVideoBitrate = estimateOptimalBitrate(targetWidth, targetHeight, targetFps) * 1000;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return reject(new Error('No se pudo inicializar el lienzo de renderizado de video'));
    }

    // Capture video stream from canvas
    const canvasStream = canvas.captureStream(targetFps);

    // Audio stream handling (Silent preview, pure encoded capture)
    let audioContext: AudioContext | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;

    if (!settings.removeAudio) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        audioSource = audioContext.createMediaElementSource(video);
        audioDest = audioContext.createMediaStreamDestination();
        audioSource.connect(audioDest);

        const audioTracks = audioDest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          canvasStream.addTrack(audioTracks[0]);
        }
      } catch {
        // In case audio context fails or video has no audio track, gracefully continue video only
      }
    }

    // Codec & Recorder setup
    const { mimeType } = getBestMimeTypeForFormat(settings.format);
    const recordedChunks: Blob[] = [];

    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: Math.max(150000, targetVideoBitrate),
      audioBitsPerSecond: settings.removeAudio ? 0 : (settings.audioBitrateKbps || 96) * 1000,
    };

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(canvasStream, recorderOptions);
    } catch {
      // Fallback to generic stream if specific mimeType was rejected
      mediaRecorder = new MediaRecorder(canvasStream);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    let animationFrameId: number | null = null;
    let frameCallbackId: number | null = null;
    let watchdogTimerId: any = null;
    let maxTimeoutId: any = null;
    let isFinished = false;
    let frameCount = 0;
    let lastFpsCheck = performance.now();
    let currentFps = 0;

    const cleanup = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (frameCallbackId && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(frameCallbackId);
      }
      if (watchdogTimerId) clearInterval(watchdogTimerId);
      if (maxTimeoutId) clearTimeout(maxTimeoutId);

      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);

      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      canvasStream.getTracks().forEach((t) => t.stop());
    };

    const completeEncoding = () => {
      if (isFinished) return;
      isFinished = true;

      if (watchdogTimerId) clearInterval(watchdogTimerId);
      if (maxTimeoutId) clearTimeout(maxTimeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } catch (err) {
        console.warn('Error al detener MediaRecorder:', err);
      }
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        isFinished = true;
        cleanup();
        if (mediaRecorder.state !== 'inactive') {
          try {
            mediaRecorder.stop();
          } catch {}
        }
        reject(new Error('Optimización cancelada'));
      });
    }

    mediaRecorder.onstop = () => {
      cleanup();

      const outputBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/mp4' });
      const url = URL.createObjectURL(outputBlob);
      const optimizedSize = outputBlob.size;
      const compressionRatio = Math.max(
        0,
        parseFloat(((1 - optimizedSize / metadata.originalSize) * 100).toFixed(1))
      );

      // Force 100% progress on completion
      onProgress(100, currentFps);

      resolve({
        blob: outputBlob,
        url,
        optimizedSize,
        compressionRatio,
      });
    };

    let hasStarted = false;
    const startProcessing = () => {
      if (hasStarted || abortSignal?.aborted) return;
      hasStarted = true;

      const speed = Math.max(1, Math.min(settings.speedMultiplier || 1, 4));
      video.playbackRate = speed;

      // Resume audio context if suspended
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      try {
        mediaRecorder.start(250); // Flush chunks every 250ms
      } catch (err) {
        cleanup();
        return reject(new Error('Error al iniciar la grabación de video: ' + (err as Error).message));
      }

      const getEffectiveDuration = () => {
        return video.duration && isFinite(video.duration) && video.duration > 0
          ? video.duration
          : metadata.duration;
      };

      const renderLoop = () => {
        if (isFinished || abortSignal?.aborted) return;

        const duration = getEffectiveDuration();

        // Check if finished or near end
        if (video.ended || (duration > 0 && video.currentTime >= Math.max(0.1, duration - 0.08))) {
          completeEncoding();
          return;
        }

        // Draw current frame scaled to canvas
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        frameCount++;
        const now = performance.now();
        if (now - lastFpsCheck >= 500) {
          currentFps = Math.round((frameCount / (now - lastFpsCheck)) * 1000);
          frameCount = 0;
          lastFpsCheck = now;
        }

        if (duration > 0) {
          const rawPercent = Math.round((video.currentTime / duration) * 100);
          const percent = Math.min(99, Math.max(1, rawPercent));
          onProgress(percent, currentFps);
        }

        if ('requestVideoFrameCallback' in video) {
          frameCallbackId = (video as any).requestVideoFrameCallback(renderLoop);
        } else {
          animationFrameId = requestAnimationFrame(renderLoop);
        }
      };

      // Video event listeners for reliable completion
      video.onended = () => {
        completeEncoding();
      };

      video.onpause = () => {
        const duration = getEffectiveDuration();
        if (duration > 0 && (video.currentTime >= duration - 0.3 || video.ended)) {
          completeEncoding();
        }
      };

      video.ontimeupdate = () => {
        const duration = getEffectiveDuration();
        if (duration > 0 && video.currentTime >= Math.max(0.1, duration - 0.08)) {
          completeEncoding();
        }
      };

      // Watchdog timer: checks every 80ms for completion or near-end stalls
      let lastTime = -1;
      let stallCount = 0;
      watchdogTimerId = setInterval(() => {
        if (isFinished || abortSignal?.aborted) {
          clearInterval(watchdogTimerId);
          return;
        }

        const duration = getEffectiveDuration();

        // 1. Direct completion check
        if (video.ended || (duration > 0 && video.currentTime >= Math.max(0.1, duration - 0.08))) {
          completeEncoding();
          return;
        }

        // 2. Playback stall detection
        if (video.currentTime === lastTime && video.currentTime > 0) {
          stallCount++;
          const progressRatio = duration > 0 ? video.currentTime / duration : 0;

          // If reached 94%+ or within 0.3s of end and hasn't moved for 400ms -> complete
          if ((progressRatio >= 0.94 || (duration > 0 && duration - video.currentTime <= 0.35)) && stallCount >= 5) {
            completeEncoding();
            return;
          }

          // If paused after starting and stuck for 1.2s -> complete
          if (video.paused && stallCount >= 15) {
            completeEncoding();
            return;
          }
        } else {
          lastTime = video.currentTime;
          stallCount = 0;
        }
      }, 80);

      // Hard timeout safeguard (expected duration + buffer)
      const expectedDurationMs = ((metadata.duration || 10) / speed) * 1000;
      const maxTimeoutMs = Math.max(12000, expectedDurationMs + 10000);
      maxTimeoutId = setTimeout(() => {
        if (!isFinished) {
          console.warn('Tiempo límite de seguridad alcanzado, finalizando exportación...');
          completeEncoding();
        }
      }, maxTimeoutMs);

      // Start video playback
      video
        .play()
        .then(() => {
          if ('requestVideoFrameCallback' in video) {
            frameCallbackId = (video as any).requestVideoFrameCallback(renderLoop);
          } else {
            animationFrameId = requestAnimationFrame(renderLoop);
          }
        })
        .catch((err) => {
          cleanup();
          reject(new Error('No se pudo reproducir el video para compresión: ' + err.message));
        });
    };

    video.oncanplay = startProcessing;
    if (video.readyState >= 2) {
      startProcessing();
    }

    video.onerror = () => {
      cleanup();
      reject(new Error('Error interno procesando el video'));
    };
  });
}

async function processVideoToGif(
  file: File,
  metadata: VideoMetadata,
  settings: OptimizationSettings,
  onProgress: (percent: number, currentFps: number) => void,
  abortSignal?: AbortSignal
): Promise<OptimizationResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    // Scale GIF to reasonable dimension for speed and compact size (max 480w)
    const aspect = metadata.width / metadata.height;
    const gifWidth = Math.min(480, metadata.width);
    const gifHeight = Math.round(gifWidth / aspect);

    const canvas = document.createElement('canvas');
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return reject(new Error('No se pudo inicializar el lienzo para GIF'));
    }

    const maxGifDuration = Math.min(15, metadata.duration); // Cap at 15s for memory safety
    const sampleFps = 10;
    const interval = 1 / sampleFps;
    const frames: GifFrame[] = [];
    let currentTime = 0;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const extractNextFrame = () => {
      if (abortSignal?.aborted) {
        cleanup();
        return reject(new Error('Operación cancelada'));
      }

      if (currentTime >= maxGifDuration) {
        cleanup();
        onProgress(85, 0);

        try {
          const gifBlob = encodeGif(gifWidth, gifHeight, frames, (encP) => {
            onProgress(85 + Math.round(encP * 0.15), 0);
          });
          const url = URL.createObjectURL(gifBlob);
          const optimizedSize = gifBlob.size;
          const compressionRatio = Math.max(
            0,
            parseFloat(((1 - optimizedSize / metadata.originalSize) * 100).toFixed(1))
          );
          onProgress(100, 0);
          resolve({ blob: gifBlob, url, optimizedSize, compressionRatio });
        } catch (err) {
          reject(err);
        }
        return;
      }

      video.currentTime = currentTime;
    };

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, gifWidth, gifHeight);
      const imageData = ctx.getImageData(0, 0, gifWidth, gifHeight);
      frames.push({ imageData, delayMs: Math.round(1000 / sampleFps) });

      const seekPercent = Math.min(85, Math.round((currentTime / maxGifDuration) * 85));
      onProgress(seekPercent, sampleFps);

      currentTime += interval;
      extractNextFrame();
    };

    video.onloadedmetadata = () => {
      extractNextFrame();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Error extrayendo fotogramas para el GIF'));
    };
  });
}
