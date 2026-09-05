/**
 * Extracts and encodes audio from a video file into a lossless 16-bit PCM WAV Blob.
 */

export async function extractAudioWav(
  videoFile: File,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await videoFile.arrayBuffer();

  if (onProgress) onProgress(20);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  if (onProgress) onProgress(60);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    interleaved = new Float32Array(left.length + right.length);
    for (let i = 0, j = 0; i < left.length; i++) {
      interleaved[j++] = left[i];
      interleaved[j++] = right[i];
    }
  } else {
    interleaved = audioBuffer.getChannelData(0);
  }

  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = interleaved.length * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  await audioContext.close();
  if (onProgress) onProgress(100);

  return new Blob([view], { type: 'audio/wav' });
}
