import JSZip from 'jszip';
import { QueueItem } from '../types';
import { generateOutputFilename } from '../utils/formatters';

export async function exportAllAsZip(
  items: QueueItem[],
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();
  const completedItems = items.filter((item) => item.status === 'completed' && item.resultBlob);

  if (completedItems.length === 0) {
    throw new Error('No hay videos completados para descargar');
  }

  completedItems.forEach((item, index) => {
    if (item.resultBlob) {
      const filename = generateOutputFilename(item.metadata.name, item.settings.format);
      // Prevent duplicate names in zip
      const uniqueName = completedItems.filter(
        (other, oIdx) => oIdx < index && other.metadata.name === item.metadata.name
      ).length > 0
        ? `${index + 1}_${filename}`
        : filename;

      zip.file(uniqueName, item.resultBlob);
    }
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE', // Videos are already compressed; STORE avoids re-compressing CPU waste
    },
    (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `videos_optimizados_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

export function downloadSingleFile(item: QueueItem): void {
  if (!item.resultBlob && !item.resultUrl) return;

  const url = item.resultUrl || (item.resultBlob ? URL.createObjectURL(item.resultBlob) : '');
  if (!url) return;

  const filename = generateOutputFilename(item.metadata.name, item.settings.format);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
