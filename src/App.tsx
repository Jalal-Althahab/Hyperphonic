import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Music, 
  Film,
  Monitor,
  Plus, 
  Trash2, 
  ListMusic,
  Maximize2,
  Minimize2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Visualizer } from './components/Visualizer';

interface Track {
  id: string;
  name: string;
  url: string;
  type: 'audio' | 'video';
  duration?: number;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [volumeIndicator, setVolumeIndicator] = useState<{ value: number; visible: boolean }>({ value: 0.7, visible: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoOnly, setIsVideoOnly] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const mediaRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (mediaRef.current && !audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioContext.createMediaElementSource(mediaRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
  }, []);

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  const togglePlay = useCallback(async () => {
    if (!mediaRef.current || tracks.length === 0) return;

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      if (currentTrackIndex === -1 && tracks.length > 0) {
        setCurrentTrackIndex(0);
      }
      mediaRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, tracks.length, currentTrackIndex]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newTracks: Track[] = (Array.from(files) as File[])
      .filter(file => file.type.startsWith('audio/') || file.type.startsWith('video/'))
      .map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'audio'
      }));

    setTracks(prev => [...prev, ...newTracks]);
    if (currentTrackIndex === -1) {
      setCurrentTrackIndex(0);
    }
  };

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  const removeTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const index = tracks.findIndex(t => t.id === id);
    if (index === currentTrackIndex) {
      setIsPlaying(false);
      setCurrentTrackIndex(-1);
    } else if (index < currentTrackIndex) {
      setCurrentTrackIndex(prev => prev - 1);
    }
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const showVolumeOverlay = useCallback((val: number) => {
    setVolumeIndicator({ value: val, visible: true });
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
      setVolumeIndicator(prev => ({ ...prev, visible: false }));
    }, 1000);
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    setVolume(prev => {
      const newVal = Math.min(1, Math.max(0, prev + delta));
      showVolumeOverlay(newVal);
      return newVal;
    });
    setIsMuted(false);
  }, [showVolumeOverlay]);

  const seek = useCallback((delta: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.min(duration, Math.max(0, mediaRef.current.currentTime + delta));
    }
  }, [duration]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
      setIsVideoOnly(false);
      setShowControls(false);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  }, []);

  const toggleVideoOnly = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
      setIsVideoOnly(true);
      setIsFullscreen(true);
      setShowControls(false);
    } else {
      if (isVideoOnly) {
        setIsVideoOnly(false);
        setIsFullscreen(false);
        document.exitFullscreen().catch(console.error);
      } else {
        setIsVideoOnly(true);
        setShowControls(false);
      }
    }
  }, [isVideoOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case ' ':
          togglePlay();
          break;
        case 'f':
        case 'F':
          toggleVideoOnly();
          break;
        case 'ArrowUp':
          adjustVolume(0.05);
          break;
        case 'ArrowDown':
          adjustVolume(-0.05);
          break;
        case 'ArrowLeft':
          seek(-5);
          break;
        case 'ArrowRight':
          seek(5);
          break;
        case 'Enter':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, adjustVolume, seek, toggleFullscreen, toggleVideoOnly]);

  const handleWheel = (e: React.WheelEvent) => {
    adjustVolume(e.deltaY > 0 ? -0.05 : 0.05);
  };

  const handleMouseMove = useCallback(() => {
    if (!isVideoOnly && !isFullscreen) {
      setShowControls(true);
      return;
    }
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, [isVideoOnly, isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setIsVideoOnly(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (currentTrack && isPlaying) {
      mediaRef.current?.play().catch(console.error);
    }
  }, [currentTrackIndex]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files) return;

    const newTracks: Track[] = (Array.from(files) as File[])
      .filter(file => file.type.startsWith('audio/') || file.type.startsWith('video/'))
      .map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'audio'
      }));

    if (newTracks.length > 0) {
      setTracks(prev => [...prev, ...newTracks]);
      if (currentTrackIndex === -1) {
        setCurrentTrackIndex(0);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none ${isVideoOnly && !showControls ? 'cursor-none' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
    >
      <div className={`w-full h-full overflow-hidden flex flex-col md:flex-row relative ${isVideoOnly ? 'bg-black' : 'glass-panel'}`}>
        
        {/* Volume Indicator Overlay */}
        <AnimatePresence>
          {volumeIndicator.visible && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-2xl flex flex-col items-center gap-2 pointer-events-none"
            >
              <Volume2 className="w-8 h-8 text-emerald-400" />
              <span className="text-2xl font-bold font-mono text-white">
                {Math.round(volumeIndicator.value * 100)}%
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Player Section */}
        <div className="flex-1 flex flex-col relative">
          <div className={`flex-1 flex flex-col overflow-hidden ${currentTrack?.type === 'video' && (isVideoOnly || isFullscreen) ? '' : (currentTrack?.type === 'video' ? '' : 'p-6')}`}>
            <AnimatePresence>
              {showControls && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex justify-between items-center mb-6 ${currentTrack?.type === 'video' ? 'p-6 pb-0' : ''} ${(isVideoOnly || isFullscreen) ? 'z-[70] relative' : ''}`}
                >
                  <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {currentTrack?.name || "Welcome"}
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
                      {currentTrack ? (isPlaying ? "Now Playing" : "Paused") : "Drop a file to start"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="control-btn"><Settings className="w-4 h-4" /></button>
                    <button 
                      onClick={toggleVideoOnly}
                      title="Cinema Mode (F)"
                      className={`control-btn ${isVideoOnly ? 'text-emerald-400' : ''}`}
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={toggleFullscreen}
                      title="App Fullscreen (Enter)"
                      className="control-btn"
                    >
                      {isFullscreen && !isVideoOnly ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => setShowPlaylist(!showPlaylist)}
                      className={`control-btn ${showPlaylist ? 'text-emerald-400' : ''}`}
                    >
                      <ListMusic className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          {/* Media Display Area */}
          <div className={`flex-1 flex flex-col items-center justify-center relative overflow-hidden ${currentTrack?.type === 'video' ? 'bg-black' : 'bg-black/40 m-6 rounded-2xl border border-white/5'}`}>
            {currentTrack?.type === 'video' ? (
              <div 
                className={`absolute inset-0 flex items-center justify-center bg-black ${(isVideoOnly || isFullscreen) ? 'z-[100] fixed inset-0' : 'z-10'}`}
              >
                <video 
                  ref={mediaRef}
                  src={currentTrack.url}
                  className={`w-full h-full bg-black ${(isVideoOnly || isFullscreen) ? 'object-cover' : 'object-contain'}`}
                  onTimeUpdate={() => setCurrentTime(mediaRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(mediaRef.current?.duration || 0)}
                  onEnded={nextTrack}
                  onClick={togglePlay}
                />
                {(isVideoOnly || isFullscreen) && showControls && (
                  <div className="absolute top-6 right-6 z-[110]">
                    <button 
                      onClick={isVideoOnly ? toggleVideoOnly : toggleFullscreen}
                      className="bg-black/40 backdrop-blur-xl p-4 rounded-full text-white hover:bg-emerald-500 hover:text-black transition-all active:scale-90 border border-white/10"
                    >
                      <Minimize2 className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div 
                  key="audio-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center w-full h-full"
                >
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-40 h-40 rounded-full bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center relative overflow-hidden shadow-2xl mb-8"
                  >
                    {isPlaying ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,rgba(16,185,129,0.4)_0%,transparent_70%)]"
                      />
                    ) : null}
                    <Music className={`w-14 h-14 ${isPlaying ? 'text-emerald-400' : 'text-zinc-600'}`} />
                  </motion.div>

                  <div className="text-center z-10">
                    <h2 className="text-xl font-bold truncate max-w-[300px] mb-1">
                      {currentTrack?.name || "No Track Selected"}
                    </h2>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                      {isPlaying ? "Now Playing" : "Paused"}
                    </p>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-24">
                    <Visualizer analyser={analyserRef.current} isPlaying={isPlaying && currentTrack?.type === 'audio'} />
                  </div>

                  {/* Hidden audio engine for music tracks */}
                  <video 
                    ref={mediaRef}
                    src={currentTrack?.url}
                    className="hidden"
                    onTimeUpdate={() => setCurrentTime(mediaRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(mediaRef.current?.duration || 0)}
                    onEnded={nextTrack}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Progress Bar & Controls */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={(isVideoOnly || isFullscreen) ? 'z-[110] fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-32 pb-8 px-8' : ''}
              >
                {/* Progress Bar */}
                <div className={`mb-6 ${currentTrack?.type === 'video' && !isVideoOnly ? 'px-6 pb-6' : ''}`}>
                  <div className="flex justify-between text-[10px] font-mono mb-2 opacity-50">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={duration || 0} 
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value);
                      setCurrentTime(time);
                      if (mediaRef.current) mediaRef.current.currentTime = time;
                    }}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Controls */}
                <div className={`flex items-center justify-between ${currentTrack?.type === 'video' ? 'px-6 pb-6' : ''}`}>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setIsMuted(!isMuted)}
                      className="control-btn"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hidden sm:block"
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <button onClick={prevTrack} className="control-btn"><SkipBack className="w-6 h-6" /></button>
                    <button 
                      onClick={togglePlay}
                      className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-black hover:bg-emerald-400 transition-all active:scale-90 shadow-lg shadow-emerald-500/20"
                    >
                      {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                    </button>
                    <button onClick={nextTrack} className="control-btn"><SkipForward className="w-6 h-6" /></button>
                  </div>

                  <div className="w-12"></div> {/* Spacer */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

        {/* Playlist Section */}
        <AnimatePresence>
          {showPlaylist && !isVideoOnly && !isFullscreen && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-full md:w-80 bg-black/40 border-l border-white/5 flex flex-col"
            >
              <div className="p-6 border-bottom border-white/5 flex justify-between items-center">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest opacity-60">Playlist</h3>
                <label className="cursor-pointer control-btn p-1">
                  <Plus className="w-4 h-4" />
                  <input 
                    type="file" 
                    multiple 
                    accept="audio/*,video/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tracks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                    <Music className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs font-mono uppercase tracking-tighter">No tracks added</p>
                  </div>
                ) : (
                  tracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setCurrentTrackIndex(index);
                        setIsPlaying(true);
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        currentTrackIndex === index 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'hover:bg-white/5 text-zinc-400'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-[10px] font-mono">
                        {currentTrackIndex === index && isPlaying ? (
                          <div className="flex gap-0.5 items-end h-3">
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-500" />
                            <motion.div animate={{ height: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-emerald-500" />
                            <motion.div animate={{ height: [12, 8, 12] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-500" />
                          </div>
                        ) : (
                          (index + 1).toString().padStart(2, '0')
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-[10px] font-mono uppercase opacity-40 flex items-center gap-1">
                          {track.type === 'video' ? <Film className="w-2 h-2" /> : <Music className="w-2 h-2" />}
                          {track.type === 'video' ? 'Video Audio' : 'Audio File'}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => removeTrack(track.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-400 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
