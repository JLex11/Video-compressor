import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileVideo,
  Film,
  Music,
  Share2,
  Sliders,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import {
  ExportFormat,
  OptimizationPresetId,
  OptimizationSettings,
  ResolutionPreset,
  FrameratePreset,
} from '../types';
import { PRESETS } from '../utils/presets';

interface PresetSelectorProps {
  settings: OptimizationSettings;
  onChange: (newSettings: OptimizationSettings) => void;
  onApplyToAll?: () => void;
  totalItemsInQueue: number;
}

// 4 discrete main quality steps for the slider
const SLIDER_LEVELS: { id: OptimizationPresetId; label: string; desc: string }[] = [
  { id: 'compact', label: 'Baja', desc: 'Máxima compresión, menor tamaño' },
  { id: 'fast', label: 'Media', desc: 'Equilibrada y rápida' },
  { id: 'high_quality', label: 'Alta', desc: 'Fidelidad visual superior' },
  { id: 'custom', label: 'Máxima', desc: 'Calidad máxima con alto bitrate' },
];

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  settings,
  onChange,
  onApplyToAll,
  totalItemsInQueue,
}) => {
  const [optOpen, setOptOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [showAdditional, setShowAdditional] = useState(
    settings.presetId === 'target_size' || settings.presetId === 'social' || (settings.presetId === 'custom' && settings.videoBitrateKbps > 0 && settings.videoBitrateKbps !== 7500)
  );

  const optRef = useRef<HTMLDivElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderAreaRef = useRef<HTMLDivElement>(null);
  const optTimeoutRef = useRef<any>(null);
  const formatTimeoutRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastWheelTimeRef = useRef(0);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (optRef.current && !optRef.current.contains(e.target as Node)) {
        setOptOpen(false);
      }
      if (formatRef.current && !formatRef.current.contains(e.target as Node)) {
        setFormatOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine current slider step index (0, 1, 2, or 3)
  const getSliderIndex = (): number => {
    if (settings.presetId === 'compact') return 0;
    if (settings.presetId === 'fast') return 1;
    if (settings.presetId === 'high_quality') return 2;
    if (settings.presetId === 'custom' && settings.videoBitrateKbps >= 7000) return 3;
    // Default to 'Media' if target_size/social is active
    return 1;
  };

  const currentSliderIndex = getSliderIndex();

  const isMainPreset =
    settings.presetId === 'compact' ||
    settings.presetId === 'fast' ||
    settings.presetId === 'high_quality' ||
    (settings.presetId === 'custom' && settings.videoBitrateKbps >= 7000);

  // Wheel scrolling listener to adjust slider smoothly by scrolling
  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      // 140ms cooldown between steps so scrolling feels crisp and doesn't skip
      if (now - lastWheelTimeRef.current < 140) return;

      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : -e.deltaX;
      if (Math.abs(delta) < 3) return;

      const currIdx = getSliderIndex();
      let nextIdx = currIdx;

      // Wheel UP / RIGHT -> increase quality towards Calidad (step + 1)
      // Wheel DOWN / LEFT -> decrease quality towards Velocidad (step - 1)
      if (delta < 0) {
        nextIdx = Math.min(3, currIdx + 1);
      } else if (delta > 0) {
        nextIdx = Math.max(0, currIdx - 1);
      }

      if (nextIdx !== currIdx) {
        lastWheelTimeRef.current = now;
        handleSelectStep(nextIdx);
      }
    };

    const el = sliderAreaRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheelEvent, { passive: false });
    }

    return () => {
      if (el) {
        el.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, [currentSliderIndex, settings.format, optOpen]);

  // Label to display on the trigger button and in the slider header
  const getQualityLabel = (): string => {
    if (settings.presetId === 'target_size') return `Tamaño: ${settings.targetSizeMB || 16}MB`;
    if (settings.presetId === 'social') return 'Redes Sociales';
    if (settings.presetId === 'compact') return 'Baja';
    if (settings.presetId === 'fast') return 'Media';
    if (settings.presetId === 'high_quality') return 'Alta';
    if (settings.presetId === 'custom') {
      return settings.videoBitrateKbps >= 7000 ? 'Máxima' : 'Personalizado';
    }
    return 'Media';
  };

  const getFormatLabel = (): string => {
    switch (settings.format) {
      case 'mp4':
        return 'MP4';
      case 'webm':
        return 'WebM';
      case 'gif':
        return 'GIF';
      case 'audio-wav':
        return 'Audio WAV';
      default:
        return 'MP4';
    }
  };

  // Handle slider step selection
  const handleSelectStep = (index: number) => {
    const level = SLIDER_LEVELS[index];
    if (level.id === 'compact') {
      const p = PRESETS.find((pr) => pr.id === 'compact')!;
      onChange({ ...p.settings, format: settings.format });
    } else if (level.id === 'fast') {
      const p = PRESETS.find((pr) => pr.id === 'fast')!;
      onChange({ ...p.settings, format: settings.format });
    } else if (level.id === 'high_quality') {
      const p = PRESETS.find((pr) => pr.id === 'high_quality')!;
      onChange({ ...p.settings, format: settings.format });
    } else {
      // Máxima (bitrate superior 7500 kbps, calidad máxima)
      onChange({
        ...settings,
        presetId: 'custom',
        resolution: 'original',
        fps: 'original',
        videoBitrateKbps: 7500,
        audioBitrateKbps: 192,
        removeAudio: false,
        speedMultiplier: 1,
      });
    }
  };

  const handleSelectAdditionalPreset = (presetId: OptimizationPresetId) => {
    const p = PRESETS.find((pr) => pr.id === presetId);
    if (p) {
      onChange({
        ...p.settings,
        format: settings.format,
      });
    }
  };

  const handleFormatChange = (fmt: ExportFormat) => {
    onChange({
      ...settings,
      format: fmt,
    });
    setFormatOpen(false);
  };

  const updateSliderFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newIndex = Math.round(ratio * 3);
    handleSelectStep(newIndex);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    setIsDragging(true);
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  // Hover handlers with slight grace period to allow smooth cursor transition
  const handleOptMouseEnter = () => {
    clearTimeout(optTimeoutRef.current);
    setOptOpen(true);
  };
  const handleOptMouseLeave = () => {
    if (isDraggingRef.current) return;
    optTimeoutRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        setOptOpen(false);
      }
    }, 150);
  };

  const handleFormatMouseEnter = () => {
    clearTimeout(formatTimeoutRef.current);
    setFormatOpen(true);
  };
  const handleFormatMouseLeave = () => {
    formatTimeoutRef.current = setTimeout(() => {
      setFormatOpen(false);
    }, 150);
  };

  const activeLabel = getQualityLabel();

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3 py-1">
      {/* 2 Compact Trigger Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* BUTTON 1: Ajustes de Optimización */}
        <div
          ref={optRef}
          onMouseEnter={handleOptMouseEnter}
          onMouseLeave={handleOptMouseLeave}
          className="relative inline-block"
        >
          <button
            type="button"
            id="opt-settings-btn"
            onClick={() => setOptOpen(!optOpen)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
              optOpen
                ? 'bg-zinc-800 text-white border-zinc-700 shadow-md'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Calidad:</span>
            <span className="font-semibold text-white">{activeLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                optOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Compact Hover Switcher Popup */}
          {optOpen && (
            <div
              className="absolute left-0 top-full pt-1.5 z-40 animate-in fade-in zoom-in-95 duration-150"
              style={{ width: '320px' }}
            >
              <div
                ref={sliderAreaRef}
                className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-md select-none"
              >
                {/* Header with current level label matching user screenshot: "Alta >" */}
                <div className="text-center mb-3">
                  <div className="text-sm font-medium text-white inline-flex items-center gap-1.5">
                    <span
                      key={isMainPreset ? SLIDER_LEVELS[currentSliderIndex].label : activeLabel}
                      className="font-semibold text-white transition-all duration-200"
                    >
                      {isMainPreset ? SLIDER_LEVELS[currentSliderIndex].label : activeLabel}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isMainPreset
                      ? SLIDER_LEVELS[currentSliderIndex].desc
                      : 'Configuración especializada activa'}
                  </p>
                </div>

                {/* Balance labels above track: Velocidad (izquierda) y Calidad (derecha) */}
                <div className="flex items-center justify-between text-[11px] mb-2 px-1 select-none">
                  <div className="flex items-center gap-1 text-amber-400 font-medium">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Velocidad</span>
                    <span className="text-[10px] text-zinc-500 font-normal">(- peso)</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-400 font-medium">
                    <span className="text-[10px] text-zinc-500 font-normal">(+ nitidez)</span>
                    <span>Calidad</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Slider bar matching image.png with instant pointer press, drag, and wheel scroll */}
                <div className="px-1 py-1 mb-2">
                  <div
                    ref={trackRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="relative w-full h-3.5 rounded-full bg-zinc-800/90 shadow-inner cursor-grab active:cursor-grabbing flex items-center select-none touch-none"
                  >
                    {/* Blue active fill track with smooth transition between steps */}
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full bg-blue-600 pointer-events-none ${
                        isDragging
                          ? 'transition-[width] duration-75 ease-out'
                          : 'transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
                      }`}
                      style={{
                        width: `${(currentSliderIndex / 3) * 100}%`,
                      }}
                    />

                    {/* Discrete dots along the track */}
                    {[0, 1, 2, 3].map((step) => {
                      const percent = (step / 3) * 100;
                      const isActive = step <= currentSliderIndex;
                      const isCurrent = step === currentSliderIndex;
                      return (
                        <div
                          key={step}
                          className={`absolute rounded-full pointer-events-none transition-all duration-300 ease-out ${
                            isCurrent
                              ? 'w-2 h-2 -ml-[4px] bg-white ring-2 ring-blue-400/40 shadow-sm'
                              : isActive
                              ? 'w-1.5 h-1.5 -ml-[3px] bg-blue-200'
                              : 'w-1.5 h-1.5 -ml-[3px] bg-zinc-600'
                          }`}
                          style={{ left: `${percent}%` }}
                        />
                      );
                    })}

                    {/* Circular white thumb with smooth glide transition */}
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white shadow-lg border border-zinc-200 -ml-2.5 flex items-center justify-center pointer-events-none ${
                        isDragging
                          ? 'scale-110 shadow-blue-500/40 ring-2 ring-blue-400 transition-transform duration-75'
                          : 'transition-[left,transform] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
                      }`}
                      style={{
                        left: `${(currentSliderIndex / 3) * 100}%`,
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 transition-colors duration-200" />
                    </div>
                  </div>

                  {/* Step labels under slider */}
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-2 px-0.5 select-none">
                    {SLIDER_LEVELS.map((lvl, idx) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => handleSelectStep(idx)}
                        className={`transition-all duration-200 hover:text-zinc-200 cursor-pointer ${
                          currentSliderIndex === idx && isMainPreset
                            ? 'text-blue-400 font-semibold scale-105'
                            : ''
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>

                  {/* Visual micro-hint for scroll support */}
                  <div className="text-center mt-2">
                    <span className="text-[10px] text-zinc-500/80">
                      Arrastra o usa la rueda del ratón (scroll)
                    </span>
                  </div>
                </div>

                {/* Additional Options Accordion / Dropdown */}
                <div className="border-t border-zinc-800/90 pt-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdditional(!showAdditional)}
                    className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 py-1 transition-colors"
                  >
                    <span className="font-medium">Opciones adicionales</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        showAdditional ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showAdditional && (
                    <div className="flex flex-col gap-1.5 pt-2 animate-in fade-in duration-100">
                      {/* 1. Tamaño objetivo */}
                      <div
                        onClick={() => handleSelectAdditionalPreset('target_size')}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                          settings.presetId === 'target_size'
                            ? 'bg-blue-950/30 border-blue-600/50 text-white'
                            : 'bg-zinc-950/40 hover:bg-zinc-800/50 border-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-medium">Tamaño objetivo</span>
                          </div>
                          {settings.presetId === 'target_size' && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 ml-5">
                          Para Discord (8MB), WhatsApp (16MB) o Email
                        </p>

                        {/* If active, allow typing target MB */}
                        {settings.presetId === 'target_size' && (
                          <div
                            className="mt-2 ml-5 flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[11px] text-zinc-400">Límite:</span>
                            <div className="flex items-center gap-1">
                              {[8, 16, 25, 50].map((mb) => (
                                <button
                                  key={mb}
                                  type="button"
                                  onClick={() =>
                                    onChange({ ...settings, targetSizeMB: mb })
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                    settings.targetSizeMB === mb
                                      ? 'bg-blue-600 text-white border-blue-500 font-bold'
                                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                                  }`}
                                >
                                  {mb}MB
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Redes Sociales & Web */}
                      <div
                        onClick={() => handleSelectAdditionalPreset('social')}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                          settings.presetId === 'social'
                            ? 'bg-blue-950/30 border-blue-600/50 text-white'
                            : 'bg-zinc-950/40 hover:bg-zinc-800/50 border-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-medium">Redes Sociales & Web</span>
                          </div>
                          {settings.presetId === 'social' && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 ml-5">
                          1080p balanceado para TikTok, Reels y Shorts
                        </p>
                      </div>

                      {/* 3. Personalizado */}
                      <div
                        onClick={() => handleSelectAdditionalPreset('custom')}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                          settings.presetId === 'custom' && settings.videoBitrateKbps !== 7500
                            ? 'bg-blue-950/30 border-blue-600/50 text-white'
                            : 'bg-zinc-950/40 hover:bg-zinc-800/50 border-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-medium">Personalizado</span>
                          </div>
                          {settings.presetId === 'custom' && settings.videoBitrateKbps !== 7500 && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 ml-5">
                          Ajuste manual de resolución, FPS y bitrate
                        </p>

                        {/* If active, show quick controls */}
                        {settings.presetId === 'custom' && settings.videoBitrateKbps !== 7500 && (
                          <div
                            className="mt-2 ml-5 grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div>
                              <span className="text-[10px] text-zinc-400 block mb-0.5">
                                Resolución:
                              </span>
                              <select
                                value={settings.resolution}
                                onChange={(e) =>
                                  onChange({
                                    ...settings,
                                    resolution: e.target.value as ResolutionPreset,
                                  })
                                }
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200"
                              >
                                <option value="original">Original</option>
                                <option value="1080p">1080p</option>
                                <option value="720p">720p</option>
                                <option value="480p">480p</option>
                              </select>
                            </div>

                            <div>
                              <span className="text-[10px] text-zinc-400 block mb-0.5">
                                FPS:
                              </span>
                              <select
                                value={settings.fps}
                                onChange={(e) =>
                                  onChange({
                                    ...settings,
                                    fps: e.target.value as FrameratePreset,
                                  })
                                }
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200"
                              >
                                <option value="original">Original</option>
                                <option value="60">60 FPS</option>
                                <option value="30">30 FPS</option>
                                <option value="24">24 FPS</option>
                              </select>
                            </div>

                            <div className="col-span-2 flex items-center justify-between pt-1">
                              <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={settings.removeAudio}
                                  onChange={(e) =>
                                    onChange({ ...settings, removeAudio: e.target.checked })
                                  }
                                  className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-0"
                                />
                                Silenciar audio
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BUTTON 2: Formato de Salida */}
        <div
          ref={formatRef}
          onMouseEnter={handleFormatMouseEnter}
          onMouseLeave={handleFormatMouseLeave}
          className="relative inline-block"
        >
          <button
            type="button"
            id="format-settings-btn"
            onClick={() => setFormatOpen(!formatOpen)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
              formatOpen
                ? 'bg-zinc-800 text-white border-zinc-700 shadow-md'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <FileVideo className="w-3.5 h-3.5 text-emerald-400" />
            <span>Formato:</span>
            <span className="font-semibold text-white">{getFormatLabel()}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                formatOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Compact Format Switcher Popup */}
          {formatOpen && (
            <div
              className="absolute left-0 top-full pt-1.5 z-40 animate-in fade-in zoom-in-95 duration-150"
              style={{ width: '230px' }}
            >
              <div className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1">
                {/* MP4 */}
                <button
                  type="button"
                  id="format-opt-mp4"
                  onClick={() => handleFormatChange('mp4')}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors text-xs ${
                    settings.format === 'mp4'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileVideo className="w-4 h-4" />
                    <div>
                      <div className="font-medium">MP4</div>
                      <div
                        className={`text-[10px] ${
                          settings.format === 'mp4' ? 'text-blue-200' : 'text-zinc-400'
                        }`}
                      >
                        Universal (H.264)
                      </div>
                    </div>
                  </div>
                  {settings.format === 'mp4' && <Check className="w-4 h-4" />}
                </button>

                {/* WebM */}
                <button
                  type="button"
                  id="format-opt-webm"
                  onClick={() => handleFormatChange('webm')}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors text-xs ${
                    settings.format === 'webm'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4" />
                    <div>
                      <div className="font-medium">WebM</div>
                      <div
                        className={`text-[10px] ${
                          settings.format === 'webm' ? 'text-blue-200' : 'text-zinc-400'
                        }`}
                      >
                        Web optimizada (VP9)
                      </div>
                    </div>
                  </div>
                  {settings.format === 'webm' && <Check className="w-4 h-4" />}
                </button>

                {/* GIF */}
                <button
                  type="button"
                  id="format-opt-gif"
                  onClick={() => handleFormatChange('gif')}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors text-xs ${
                    settings.format === 'gif'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4" />
                    <div>
                      <div className="font-medium">GIF Animado</div>
                      <div
                        className={`text-[10px] ${
                          settings.format === 'gif' ? 'text-blue-200' : 'text-zinc-400'
                        }`}
                      >
                        Bucle ligero sin audio
                      </div>
                    </div>
                  </div>
                  {settings.format === 'gif' && <Check className="w-4 h-4" />}
                </button>

                {/* Audio WAV */}
                <button
                  type="button"
                  id="format-opt-audio"
                  onClick={() => handleFormatChange('audio-wav')}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-colors text-xs ${
                    settings.format === 'audio-wav'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Music className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Audio WAV</div>
                      <div
                        className={`text-[10px] ${
                          settings.format === 'audio-wav' ? 'text-blue-200' : 'text-zinc-400'
                        }`}
                      >
                        Extraer pista de sonido
                      </div>
                    </div>
                  </div>
                  {settings.format === 'audio-wav' && <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action to apply to all items if queue has multiple */}
      {totalItemsInQueue > 1 && onApplyToAll && (
        <button
          type="button"
          id="apply-settings-all-btn"
          onClick={onApplyToAll}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 transition-colors"
        >
          Aplicar a los {totalItemsInQueue} videos
        </button>
      )}
    </div>
  );
};
