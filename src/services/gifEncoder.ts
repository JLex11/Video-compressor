/**
 * High-performance lightweight client-side GIF89a encoder.
 * Allows instant conversion of video frames to animated GIF without external heavy WASM.
 */

export interface GifFrame {
  imageData: ImageData;
  delayMs: number;
}

export function encodeGif(
  width: number,
  height: number,
  frames: GifFrame[],
  onProgress?: (percent: number) => void
): Blob {
  const bytes: number[] = [];

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
  };

  const writeShort = (val: number) => {
    bytes.push(val & 0xff);
    bytes.push((val >> 8) & 0xff);
  };

  // Header: GIF89a
  writeString('GIF89a');

  // Logical Screen Descriptor
  writeShort(width);
  writeShort(height);
  // Packed: Global Color Table Flag = 0, Color Resolution = 7, Sort = 0, GCT Size = 0
  bytes.push(0x70);
  bytes.push(0); // Background Color Index
  bytes.push(0); // Pixel Aspect Ratio

  // Netscape 2.0 Loop Block (loop forever)
  bytes.push(0x21); // Extension Introducer
  bytes.push(0xff); // Application Extension Label
  bytes.push(11);   // Block Size
  writeString('NETSCAPE2.0');
  bytes.push(3);    // Sub-block Length
  bytes.push(1);    // Sub-block ID
  writeShort(0);    // Loop Count (0 = infinity)
  bytes.push(0);    // Block Terminator

  // Process frames
  const totalFrames = frames.length;
  for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
    const frame = frames[fIdx];
    const delayHundredths = Math.max(2, Math.round(frame.delayMs / 10));

    // Quantize 24-bit RGB to simple 256-color palette (Uniform 3-3-2 color quantization for speed)
    const { indexedPixels, palette } = quantizeFrameFast(frame.imageData);

    // Graphic Control Extension
    bytes.push(0x21); // Extension Introducer
    bytes.push(0xf9); // Graphic Control Label
    bytes.push(4);    // Block Size
    bytes.push(0x04); // Packed: Disposal Method = 1 (Do not dispose), User Input = 0, Transparent Color = 0
    writeShort(delayHundredths); // Delay time
    bytes.push(0);    // Transparent Color Index
    bytes.push(0);    // Block Terminator

    // Image Descriptor
    bytes.push(0x2c); // Image Separator
    writeShort(0);    // Left Position
    writeShort(0);    // Top Position
    writeShort(width);
    writeShort(height);
    // Packed: Local Color Table Flag = 1, Interlace = 0, Sort = 0, LCT Size = 7 (256 colors)
    bytes.push(0x87);

    // Local Color Table (256 * 3 bytes)
    for (let c = 0; c < 256; c++) {
      const color = palette[c] || [0, 0, 0];
      bytes.push(color[0]);
      bytes.push(color[1]);
      bytes.push(color[2]);
    }

    // LZW Minimum Code Size
    const minCodeSize = 8;
    bytes.push(minCodeSize);

    // LZW Compression
    const lzwData = lzwEncode(indexedPixels, minCodeSize);
    for (let i = 0; i < lzwData.length; i += 254) {
      const chunk = lzwData.subarray(i, Math.min(i + 254, lzwData.length));
      bytes.push(chunk.length);
      for (let j = 0; j < chunk.length; j++) {
        bytes.push(chunk[j]);
      }
    }
    bytes.push(0); // Block Terminator

    if (onProgress) {
      onProgress(Math.round(((fIdx + 1) / totalFrames) * 100));
    }
  }

  // GIF Trailer
  bytes.push(0x3b);

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

// 3-3-2 Fast Quantization (256 colors: 8 red * 8 green * 4 blue)
function quantizeFrameFast(imgData: ImageData): {
  indexedPixels: Uint8Array;
  palette: number[][];
} {
  const data = imgData.data;
  const numPixels = imgData.width * imgData.height;
  const indexedPixels = new Uint8Array(numPixels);
  const palette: number[][] = new Array(256);

  for (let r = 0; r < 8; r++) {
    for (let g = 0; g < 8; g++) {
      for (let b = 0; b < 4; b++) {
        const index = (r << 5) | (g << 2) | b;
        palette[index] = [
          Math.round((r / 7) * 255),
          Math.round((g / 7) * 255),
          Math.round((b / 3) * 255),
        ];
      }
    }
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i] >> 5;     // 0..7
    const g = data[i + 1] >> 5; // 0..7
    const b = data[i + 2] >> 6; // 0..3
    indexedPixels[p] = (r << 5) | (g << 2) | b;
  }

  return { indexedPixels, palette };
}

// LZW bit-packing encoder for GIF
function lzwEncode(indexedPixels: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const dictionary = new Map<number, number>();
  const output: number[] = [];

  let curAccum = 0;
  let curBits = 0;

  const emitCode = (code: number) => {
    curAccum |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      output.push(curAccum & 0xff);
      curAccum >>= 8;
      curBits -= 8;
    }
  };

  const resetDict = () => {
    dictionary.clear();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  emitCode(clearCode);

  let prefix = indexedPixels[0];

  for (let i = 1; i < indexedPixels.length; i++) {
    const k = indexedPixels[i];
    const key = (prefix << 8) | k;

    if (dictionary.has(key)) {
      prefix = dictionary.get(key)!;
    } else {
      emitCode(prefix);

      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        if (nextCode === 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        emitCode(clearCode);
        resetDict();
      }
      prefix = k;
    }
  }

  emitCode(prefix);
  emitCode(eoiCode);

  if (curBits > 0) {
    output.push(curAccum & 0xff);
  }

  return new Uint8Array(output);
}
