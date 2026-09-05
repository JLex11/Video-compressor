import React, { useRef, useState } from 'react';
import { FileVideo, Upload } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  totalInQueue: number;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  isLoading,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const videoFiles = (Array.from(e.dataTransfer.files) as File[]).filter((file: File) =>
        file.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|flv|wmv|m4v|3gp)$/i.test(file.name)
      );
      if (videoFiles.length > 0) {
        onFilesSelected(videoFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.flv,.wmv,.m4v,.3gp"
        className="hidden"
        id="video-file-input"
        onChange={handleFileInputChange}
      />

      <div
        id="drop-zone-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border border-dashed transition-all duration-200 py-10 px-6 text-center ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-zinc-800/80 hover:border-zinc-700 bg-transparent hover:bg-zinc-900/30'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isDragActive
                ? 'bg-blue-500 text-white'
                : 'text-zinc-400 group-hover:text-zinc-200 bg-zinc-900/80 border border-zinc-800/80'
            }`}
          >
            {isDragActive ? (
              <Upload className="w-5 h-5 animate-bounce" />
            ) : (
              <FileVideo className="w-5 h-5 text-blue-400" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm sm:text-base font-medium text-zinc-200">
            {isLoading
              ? 'Analizando videos...'
              : isDragActive
              ? 'Suelta los videos aquí'
              : 'Arrastra tus videos aquí'}
          </h3>

          {/* Centered Select Video Button */}
          <button
            type="button"
            id="select-files-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
          >
            Seleccionar video
          </button>
        </div>
      </div>
    </div>
  );
};
