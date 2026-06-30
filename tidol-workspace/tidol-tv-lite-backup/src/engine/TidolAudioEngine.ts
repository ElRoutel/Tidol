import { UnifiedTrack } from '../types/music';
import { PlaybackState } from '../types';


interface AudioEngineConfig {
    crossfadeDuration: number;
    djCueOutOffset: number;
    restartThreshold: number;
    timeUpdateThrottle: number;
}


export interface AudioEngineEvents {
    statechange: PlaybackState;
    timeupdate: { currentTime: number; duration: number };
    trackchange: UnifiedTrack | null;
    metadataupdate: { trackId: string, metadata: any };
    ended: void;
    error: any;
}


/**
 * Motor de Audio de Tidol - Arquitectura dual-player con crossfade
 */
export class TidolAudioEngine extends EventTarget {
    private audioElementA: HTMLAudioElement;
    private audioElementB: HTMLAudioElement;
    private activePlayer: 'A' | 'B';
    private state: PlaybackState;
    private queue: UnifiedTrack[];
    private currentIndex: number;
    private _volume: number;
    private _currentTime: number;
    private _duration: number;
    private currentTrack: UnifiedTrack | null;
    private config: AudioEngineConfig;
    private crossfadeInterval: number | null = null;
    private isTransitioning: boolean = false;
    private voxMode: boolean = false;
    private voxType: 'vocals' | 'accompaniment' = 'vocals';
    private _hotSwapping: boolean = false; // ✅ FIX 5: guardia anti-loop en hot-swap


    constructor(config?: Partial<AudioEngineConfig>) {
        super();

        this.config = {
            crossfadeDuration: config?.crossfadeDuration ?? 2,
            djCueOutOffset: config?.djCueOutOffset ?? 3,
            restartThreshold: config?.restartThreshold ?? 3,
            timeUpdateThrottle: config?.timeUpdateThrottle ?? 100
        };

        this.audioElementA = new Audio();
        this.audioElementB = new Audio();
        this.activePlayer = 'A';
        this.state = 'STOPPED';
        this.queue = [];
        this.currentIndex = -1;
        this._volume = 1;
        this._currentTime = 0;
        this._duration = 0;
        this.currentTrack = null;
        this.crossfadeInterval = null;
        this.isTransitioning = false;
        this.voxMode = false;
        this.voxType = 'vocals';
        this._hotSwapping = false;

        [this.audioElementA, this.audioElementB].forEach(audio => {
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';
        });

        this._setupEventListeners();
    }


    // ─────────────────────────────────────────────────────────────
    // VOX
    // ─────────────────────────────────────────────────────────────

    public setVoxState(enabled: boolean, type: 'vocals' | 'accompaniment' = 'vocals'): void {
        const changed = this.voxMode !== enabled || this.voxType !== type;
        if (!changed) return;

        console.log(`[AudioEngine] Vox state changing: ${this.voxMode}->${enabled}, ${this.voxType}->${type}`);
        this.voxMode = enabled;
        this.voxType = type;

        if (this.currentTrack && this.state !== 'STOPPED' && !this.isTransitioning) {
            const hasStems = (this.currentTrack as any).stems?.[type];

            if (enabled && !hasStems) {
                console.log(`[AudioEngine] Vox enabled but stems NOT ready. Waiting for loadMetadata.`);
                return;
            }

            const currentTime = this.getCurrentTime();
            console.log(`[AudioEngine] Reloading track for Vox/Original switch at ${currentTime}s`);
            this.playTrack(this.currentTrack, currentTime);
        }
    }


    // ─────────────────────────────────────────────────────────────
    // PRIVATE: construir URL del stem correctamente
    // ─────────────────────────────────────────────────────────────

    // ✅ FIX 2: construye la URL usando el filename real, no el ID numérico
    private buildStemUrl(track: UnifiedTrack, stemType: 'vocals' | 'accompaniment'): string | null {
        // 1. Usar URL inyectada por loadMetadata si es válida (no viene del endpoint /vox/stream/:id)
        const injected = (track as any).stems?.[stemType];
        if (injected && !injected.includes('/vox/stream/')) {
            return injected;
        }

        // 2. Construir desde file_path / local_path
        const filePath: string = (track as any).file_path
            || (track as any).local_path
            || (track as any).localPath
            || '';

        if (!filePath) return null;

        const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
        if (!filename) return null;

        return `/stems/${encodeURIComponent(filename)}/${stemType}.wav`;
    }


    // ─────────────────────────────────────────────────────────────
    // EVENT LISTENERS
    // ─────────────────────────────────────────────────────────────

    private _setupEventListeners(): void {
        const handleTimeUpdate = (e: Event) => {
            const audio = e.target as HTMLAudioElement;
            if (audio !== this.getActiveAudio()) return;

            this._currentTime = audio.currentTime;
            this._duration = audio.duration || 0;

            this.dispatchEvent(new CustomEvent('timeupdate', {
                detail: { currentTime: this._currentTime, duration: this._duration }
            }));
        };

        const handleEnded = (e: Event) => {
            const audio = e.target as HTMLAudioElement;
            if (audio !== this.getActiveAudio()) return;
            if (!this.isTransitioning) {
                this.dispatchEvent(new Event('ended'));
            }
        };

        // ✅ FIX 1: filtrar por activePlayer igual que handlePause
        const handlePlay = (e: Event) => {
            const audio = e.target as HTMLAudioElement;
            if (audio !== this.getActiveAudio()) return;
            this.state = 'PLAYING';
            this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));
        };

        const handlePause = (e: Event) => {
            const audio = e.target as HTMLAudioElement;
            if (audio !== this.getActiveAudio()) return;
            if (!this.crossfadeInterval) {
                this.state = 'PAUSED';
                this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));
            }
        };

        const handleError = (e: Event) => {
            const audio = e.target as HTMLAudioElement;
            console.error('Audio playback error:', audio.error);
            this.state = 'STOPPED';
            this.dispatchEvent(new CustomEvent('error', { detail: audio.error }));
            this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));
        };

        [this.audioElementA, this.audioElementB].forEach(audio => {
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('play', handlePlay);
            audio.addEventListener('pause', handlePause);
            audio.addEventListener('error', handleError);
        });
    }


    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    private getActiveAudio(): HTMLAudioElement {
        return this.activePlayer === 'A' ? this.audioElementA : this.audioElementB;
    }

    private getNextAudio(): HTMLAudioElement {
        return this.activePlayer === 'A' ? this.audioElementB : this.audioElementA;
    }


    // ─────────────────────────────────────────────────────────────
    // STREAM RESOLUTION
    // ─────────────────────────────────────────────────────────────

    private async resolveStreamUrl(track: UnifiedTrack): Promise<{
        streamUrl: string;
        provider: string;
        metadata: any;
        fallbacks: string[];
    }> {
        // --- PRIORIDAD: VOX MODE (STEMS) ---
        if (this.voxMode) {
            const stemUrl = this.buildStemUrl(track, this.voxType);
            if (stemUrl) {
                console.log(`[AudioEngine] Using VOX stem: ${this.voxType} -> ${stemUrl}`);
                return {
                    streamUrl: stemUrl,
                    provider: `vox-${this.voxType}`,
                    metadata: { isVox: true, originalProvider: track.sourceType },
                    fallbacks: [track.playbackUrl]
                };
            }
        }

        if (track.playbackUrl?.startsWith('blob:')) {
            return { streamUrl: track.playbackUrl, provider: 'local-blob', metadata: { isLocal: true }, fallbacks: [] };
        }

        try {
            const trackId = track.trackId || track.id || 'unknown';
            const streamUrl = `/api/v1/stream/${encodeURIComponent(trackId)}`;

            return {
                streamUrl,
                provider: track.sourceType,
                metadata: { source: track.sourceType },
                fallbacks: []
            };
        } catch (error) {
            console.warn('[AudioEngine] Error resolving stream:', error);
            return { streamUrl: track.playbackUrl, provider: 'legacy', metadata: {}, fallbacks: [] };
        }
    }


    // ─────────────────────────────────────────────────────────────
    // PLAYBACK
    // ─────────────────────────────────────────────────────────────

    async playTrack(track: UnifiedTrack, startTime: number = 0): Promise<void> {
        this.state = 'LOADING';
        this.currentTrack = track;
        this.dispatchEvent(new CustomEvent('trackchange', { detail: track }));
        this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));

        try {
            const { streamUrl, provider, metadata } = await this.resolveStreamUrl(track);

            this.dispatchEvent(new CustomEvent('providerchange', {
                detail: { provider, metadata, songId: track.id }
            }));

            const activeAudio = this.getActiveAudio();

            // ✅ FIX 3: fallback automático al audio original si el stem falla
            const errorHandler = async (_e: Event) => {
                activeAudio.removeEventListener('error', errorHandler);
                console.warn(`[AudioEngine] Playback error on provider ${provider}, attempting fallback...`);

                if (provider?.startsWith('vox-') && track.playbackUrl) {
                    console.log(`[AudioEngine] VOX stem failed — falling back to original audio`);
                    activeAudio.src = track.playbackUrl;
                    activeAudio.volume = this._volume;
                    if (startTime > 0) activeAudio.currentTime = startTime;
                    await activeAudio.play().catch(err =>
                        console.error('[AudioEngine] Fallback also failed:', err)
                    );
                }
            };
            activeAudio.addEventListener('error', errorHandler, { once: true });

            activeAudio.src = streamUrl;
            activeAudio.volume = this._volume;

            // ✅ FIX 4: loadedmetadata es más fiable que canplay para seek
            if (startTime > 0) {
                activeAudio.addEventListener('loadedmetadata', () => {
                    activeAudio.currentTime = startTime;
                }, { once: true });
            }

            await activeAudio.play();

            // Seguro secundario por si loadedmetadata ya pasó antes de registrar el listener
            if (startTime > 0 && Math.abs(activeAudio.currentTime - startTime) > 0.5) {
                activeAudio.currentTime = startTime;
            }

            activeAudio.removeEventListener('error', errorHandler);

            this.state = 'PLAYING';
            this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('[AudioEngine] Play request aborted by new load request.');
                return;
            }

            console.error('Play error:', error);
            if (error instanceof Error) console.error('Error stack:', error.stack);
            if (this.getActiveAudio().error) {
                console.error('HTMLAudioElement error code:', this.getActiveAudio().error?.code);
                console.error('HTMLAudioElement error message:', this.getActiveAudio().error?.message);
            }

            this.state = 'STOPPED';
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            this.dispatchEvent(new CustomEvent('statechange', { detail: this.state }));
        }
    }

    pause(): void {
        const activeAudio = this.getActiveAudio();
        activeAudio.pause();

        if (this.crossfadeInterval) {
            clearInterval(this.crossfadeInterval);
            this.crossfadeInterval = null;
            this.getNextAudio().pause();
            this.isTransitioning = false;
        }
    }

    async resume(): Promise<void> {
        try {
            await this.getActiveAudio().play();
        } catch (error: any) {
            console.error('Resume error:', error);
            throw error;
        }
    }

    seek(time: number): void {
        if (Number.isFinite(time)) {
            const activeAudio = this.getActiveAudio();
            activeAudio.currentTime = time;
            this._currentTime = time;
        }
    }

    setVolume(volume: number): void {
        this._volume = Math.min(1, Math.max(0, volume));
        const activeAudio = this.getActiveAudio();
        activeAudio.volume = this._volume;
        activeAudio.muted = this._volume === 0;
    }


    // ─────────────────────────────────────────────────────────────
    // CROSSFADE
    // ─────────────────────────────────────────────────────────────

    async performCrossfade(nextTrack: UnifiedTrack, duration?: number): Promise<void> {
        const activeAudio = this.getActiveAudio();
        const nextAudio = this.getNextAudio();
        const crossfadeDuration = duration ?? this.config.crossfadeDuration;
        this.isTransitioning = true;

        try {
            const { streamUrl, provider, metadata } = await this.resolveStreamUrl(nextTrack);

            this.dispatchEvent(new CustomEvent('providerchange', {
                detail: { provider, metadata, songId: nextTrack.id }
            }));

            nextAudio.src = streamUrl;
            nextAudio.volume = 0;

            if (nextTrack.attributes.cue_in) {
                nextAudio.currentTime = nextTrack.attributes.cue_in;
            }

            await nextAudio.play();
        } catch (error: any) {
            console.error('Crossfade error:', error);
            this.isTransitioning = false;
            activeAudio.pause();
            activeAudio.currentTime = 0;
            this.state = 'STOPPED';
            return;
        }

        // Crossfade lineal (suma constante de amplitudes)
        const steps = 60 * crossfadeDuration;
        let step = 0;

        this.crossfadeInterval = window.setInterval(() => {
            step++;
            const t = step / steps;
            const fadeOutGain = Math.max(0, 1 - t);
            const fadeInGain = Math.min(1, t);

            activeAudio.volume = this._volume * fadeOutGain;
            nextAudio.volume = this._volume * fadeInGain;

            if (step >= steps) {
                clearInterval(this.crossfadeInterval!);
                this.crossfadeInterval = null;

                activeAudio.pause();
                activeAudio.currentTime = 0;
                activeAudio.volume = this._volume;
                nextAudio.volume = this._volume;

                this.activePlayer = this.activePlayer === 'A' ? 'B' : 'A';
                this.isTransitioning = false;
                this.currentTrack = nextTrack;

                this.dispatchEvent(new CustomEvent('trackchange', { detail: nextTrack }));
            }
        }, 1000 / 60);
    }


    // ─────────────────────────────────────────────────────────────
    // QUEUE
    // ─────────────────────────────────────────────────────────────

    preloadNext(): void {
        if (this.currentIndex < this.queue.length - 1) {
            const nextTrack = this.queue[this.currentIndex + 1];
            const nextAudio = this.getNextAudio();
            if (nextTrack?.playbackUrl) {
                nextAudio.src = nextTrack.playbackUrl;
                nextAudio.load();
            }
        }
    }

    setQueue(tracks: UnifiedTrack[], startIndex: number = 0): void {
        this.queue = tracks;
        this.currentIndex = startIndex;
    }

    addToQueue(track: UnifiedTrack): void {
        this.queue.push(track);
    }


    // ─────────────────────────────────────────────────────────────
    // METADATA HOT-SWAP
    // ─────────────────────────────────────────────────────────────

    loadMetadata(trackId: string, metadata: any): void {
        console.log(`[AudioEngine] Injecting dynamic metadata for: ${trackId}`, metadata);

        if (this.currentTrack && this.currentTrack.id === trackId) {
            const attr = this.currentTrack.attributes as any;
            attr.bpm = metadata.bpm || attr.bpm;
            attr.first_beat_ms = metadata.first_beat_ms || attr.first_beat_ms;
            attr.beat_grid = metadata.beatGrid || attr.beat_grid;
            attr.segments = metadata.segments || attr.segments;

            const oldStems = (this.currentTrack as any).stems;

            if (metadata.stems) {
                (this.currentTrack as any).stems = metadata.stems;

                // ✅ FIX 5: guardia _hotSwapping para evitar loop infinito
                if (this.voxMode && !oldStems && this.state === 'PLAYING' && !this._hotSwapping) {
                    this._hotSwapping = true;
                    const currentTime = this.getCurrentTime();
                    console.log(`[AudioEngine] Stems detected! Performing seamless hot-swap at ${currentTime}s`);
                    this.playTrack(this.currentTrack, currentTime).finally(() => {
                        this._hotSwapping = false;
                    });
                }
            }
        }

        this.dispatchEvent(new CustomEvent('metadataupdate', {
            detail: { trackId, metadata }
        }));
    }


    // ─────────────────────────────────────────────────────────────
    // GETTERS
    // ─────────────────────────────────────────────────────────────

    getCurrentTime(): number { return this._currentTime; }
    getDuration(): number { return this._duration; }
    getState(): PlaybackState { return this.state; }
    getCurrentSong(): UnifiedTrack | null { return this.currentTrack; }
    getQueue(): UnifiedTrack[] { return [...this.queue]; }
    getCurrentIndex(): number { return this.currentIndex; }
    getVolume(): number { return this._volume; }


    // ─────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────

    destroy(): void {
        if (this.crossfadeInterval) clearInterval(this.crossfadeInterval);
        [this.audioElementA, this.audioElementB].forEach(audio => {
            audio.pause();
            audio.src = '';
            audio.load();
        });
    }
}
