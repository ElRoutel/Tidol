import { useRef, useCallback, useState, useEffect } from 'react';

const VOX_API_BASE = '/api/vox';
const STEMS_BASE = '/stems';

// ── Drift threshold (seconds) ────────────────────────────────
// If the Web Audio stems drift more than this from the HTML <audio>,
// we silently recreate the source nodes to re-sync.
const DRIFT_THRESHOLD = 0.2;

// ── Singleton AudioContext ───────────────────────────────────
let sharedAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedAudioContext;
}

// ── Types ────────────────────────────────────────────────────
export interface VoxState {
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    progress: number;
    error: string | null;
    stemsAvailable: boolean;
}

interface StemSyncInfo {
    /** AudioContext.currentTime at moment of source.start() */
    ctxStartTime: number;
    /** HTML <audio> currentTime used as offset for source.start(0, offset) */
    audioOffset: number;
}

// ── Hook ─────────────────────────────────────────────────────
export function useVoxAudio() {
    const [voxState, setVoxState] = useState<VoxState>({
        status: 'idle',
        progress: 0,
        error: null,
        stemsAvailable: false,
    });

    const activeJobId = useRef<string | null>(null);
    const eventSource = useRef<EventSource | null>(null);
    const folderNameRef = useRef<string | null>(null);

    // Web Audio refs
    const buffers = useRef<{ vocals: AudioBuffer | null; accompaniment: AudioBuffer | null }>({
        vocals: null,
        accompaniment: null,
    });
    const activeSources = useRef<{
        vocals: AudioBufferSourceNode | null;
        accompaniment: AudioBufferSourceNode | null;
    }>({ vocals: null, accompaniment: null });
    const gainNodes = useRef<{ vocals: GainNode | null; accompaniment: GainNode | null }>({
        vocals: null,
        accompaniment: null,
    });
    const syncInfo = useRef<StemSyncInfo | null>(null);
    const isProcessingRef = useRef(false);

    // ── Helpers ──────────────────────────────────────────────

    const closeSSE = useCallback(() => {
        if (eventSource.current) {
            eventSource.current.close();
            eventSource.current = null;
        }
    }, []);

    /** Stop existing source nodes (they are one-time-use per spec). */
    const stopStems = useCallback(() => {
        for (const key of ['vocals', 'accompaniment'] as const) {
            const src = activeSources.current[key];
            if (src) {
                try { src.stop(); } catch (_) { /* already stopped */ }
                src.disconnect();
                activeSources.current[key] = null;
            }
        }
        syncInfo.current = null;
    }, []);

    /** Create fresh source nodes from pre-loaded buffers at the given offset. */
    const startStems = useCallback((offsetSeconds: number) => {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Defensive: stop any lingering nodes first
        stopStems();

        if (!buffers.current.vocals || !buffers.current.accompaniment) {
            console.warn('[useVoxAudio] startStems called but buffers are not loaded yet.');
            return;
        }

        // Clamp offset to buffer duration
        const clamp = (t: number, buf: AudioBuffer) => Math.max(0, Math.min(t, buf.duration - 0.01));

        for (const key of ['vocals', 'accompaniment'] as const) {
            const buf = buffers.current[key]!;
            const gain = gainNodes.current[key];
            if (!gain) continue;

            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(gain);
            src.start(0, clamp(offsetSeconds, buf));
            // When the source reaches the end, auto-null the ref
            src.onended = () => { activeSources.current[key] = null; };
            activeSources.current[key] = src;
        }

        syncInfo.current = {
            ctxStartTime: ctx.currentTime,
            audioOffset: offsetSeconds,
        };
    }, [stopStems]);

    /** Toggle which stem is audible. No new source nodes needed — just gain. */
    const setActiveType = useCallback((type: 'vocals' | 'accompaniment' | 'none') => {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        if (gainNodes.current.vocals) {
            gainNodes.current.vocals.gain.setTargetAtTime(type === 'vocals' ? 1 : 0, now, 0.05);
        }
        if (gainNodes.current.accompaniment) {
            gainNodes.current.accompaniment.gain.setTargetAtTime(type === 'accompaniment' ? 1 : 0, now, 0.05);
        }
    }, []);

    /**
     * Lightweight drift check. Call from a low-frequency interval (~1 Hz).
     * If the Web Audio stems have drifted beyond DRIFT_THRESHOLD from the
     * HTML <audio> element's currentTime, silently re-sync.
     */
    const checkDrift = useCallback((htmlAudioCurrentTime: number) => {
        if (!syncInfo.current || !activeSources.current.vocals) return;
        const ctx = getAudioContext();
        const elapsed = ctx.currentTime - syncInfo.current.ctxStartTime;
        const expectedAudioTime = syncInfo.current.audioOffset + elapsed;
        const drift = Math.abs(expectedAudioTime - htmlAudioCurrentTime);

        if (drift > DRIFT_THRESHOLD) {
            console.log(`[useVoxAudio] Drift detected: ${drift.toFixed(3)}s → re-syncing stems`);
            startStems(htmlAudioCurrentTime);
        }
    }, [startStems]);

    // ── Cleanup on unmount ───────────────────────────────────
    useEffect(() => {
        return () => {
            closeSSE();
            stopStems();
        };
    }, [closeSSE, stopStems]);

    // ── SSE: Process and Listen ──────────────────────────────

    const processAndListen = useCallback(async (song: any) => {
        console.log('[useVoxAudio] ═══════════ processAndListen CALLED ═══════════');
        console.log('[useVoxAudio] Song object received:', JSON.stringify({
            id: song?.id,
            identifier: song?.identifier,
            title: song?.titulo || song?.title || song?.attributes?.name,
            file_path: song?.file_path,
            filepath: song?.filepath,
            local_path: song?.local_path,
            localPath: song?.localPath,
            archivo: song?.archivo,
            playbackUrl: song?.playbackUrl,
            url: song?.url,
            sourceType: song?.sourceType,
        }, null, 2));

        if (!song) {
            console.error('[useVoxAudio] ❌ EARLY RETURN: song is null/undefined');
            return;
        }

        // ═══ GUARD: Prevent machine-gun firing ═══
        if (isProcessingRef.current) {
            console.warn('[useVoxAudio] ⚠️ BLOCKED: processAndListen already in-flight, skipping duplicate call');
            return;
        }
        isProcessingRef.current = true;

        // ═══ FIX: Resolve filepath from ALL possible field names ═══
        // The raw DB uses "archivo", UnifiedTrack uses "playbackUrl", 
        // legacy code used "file_path"/"filepath"/"local_path"/"localPath"
        const filepath = song.archivo
            || song.file_path
            || song.filepath
            || song.local_path
            || song.localPath;

        // ═══ FIX: Strip "local-" prefix from UnifiedTrack IDs ═══
        let tidolId = song.id || song.identifier;
        if (typeof tidolId === 'string' && tidolId.startsWith('local-')) {
            tidolId = tidolId.replace('local-', '');
        }

        console.log('[useVoxAudio] Resolved filepath:', filepath);
        console.log('[useVoxAudio] Resolved tidolId:', tidolId);

        if (!filepath || !tidolId) {
            const msg = `Missing: filepath=${filepath}, tidolId=${tidolId}`;
            console.error(`[useVoxAudio] ❌ EARLY RETURN: ${msg}`);
            setVoxState({ status: 'error', progress: 0, error: msg, stemsAvailable: false });
            return;
        }

        const folderName = filepath.split('/').pop()?.replace(/\.[^/.]+$/, '');
        if (!folderName) {
            console.error('[useVoxAudio] ❌ EARLY RETURN: Could not derive folderName from', filepath);
            setVoxState({ status: 'error', progress: 0, error: 'Could not derive folder name', stemsAvailable: false });
            return;
        }
        folderNameRef.current = folderName;
        console.log('[useVoxAudio] Derived folderName:', folderName);

        // Quick HEAD check: stems already exist?
        try {
            const url = `${STEMS_BASE}/${encodeURIComponent(folderName)}/vocals.wav`;
            console.log('[useVoxAudio] HEAD check:', url);
            const check = await fetch(url, { method: 'HEAD' });
            console.log('[useVoxAudio] HEAD response:', check.status);
            if (check.ok) {
                console.log('[useVoxAudio] ✅ Stems already exist! Preloading…');
                setVoxState({ status: 'completed', progress: 100, error: null, stemsAvailable: true });
                await preloadStems(folderName);
                return;
            }
        } catch (headErr: any) {
            console.log('[useVoxAudio] HEAD check failed (expected if stems not generated yet):', headErr.message);
        }

        // Enqueue a Vox job
        try {
            setVoxState({ status: 'queued', progress: 0, error: null, stemsAvailable: false });

            const postBody = { targetPath: filepath, tidol_id: tidolId };
            console.log('[useVoxAudio] 🚀 POST /api/vox/process →', JSON.stringify(postBody));

            const res = await fetch(`${VOX_API_BASE}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postBody),
            });

            console.log('[useVoxAudio] POST response status:', res.status);

            if (!res.ok) {
                const errBody = await res.text();
                console.error('[useVoxAudio] ❌ POST failed:', errBody);
                throw new Error(`Vox job failed: HTTP ${res.status} — ${errBody}`);
            }

            const data = await res.json();
            const jobId = data.jobId;
            activeJobId.current = jobId;
            console.log('[useVoxAudio] ✅ Job queued! jobId:', jobId);

            // Open SSE stream
            closeSSE();
            const sseUrl = `${VOX_API_BASE}/status/${jobId}`;
            console.log('[useVoxAudio] Opening SSE:', sseUrl);
            const sse = new EventSource(sseUrl);
            eventSource.current = sse;

            sse.onmessage = async (e) => {
                try {
                    const update = JSON.parse(e.data);
                    console.log('[useVoxAudio] SSE update:', update);
                    setVoxState({
                        status: update.status,
                        progress: update.progress ?? 0,
                        error: update.error || null,
                        stemsAvailable: update.status === 'completed',
                    });

                    if (update.status === 'completed') {
                        console.log('[useVoxAudio] ✅ Job completed! Preloading stems…');
                        closeSSE();
                        activeJobId.current = null;
                        await preloadStems(folderName);
                    } else if (update.status === 'error') {
                        console.error('[useVoxAudio] ❌ Job error:', update.error);
                        closeSSE();
                        activeJobId.current = null;
                    }
                } catch (parseErr: any) {
                    console.error('[useVoxAudio] SSE parse error:', parseErr);
                    setVoxState(s => ({ ...s, status: 'error', error: 'Failed to parse SSE event' }));
                    closeSSE();
                }
            };

            sse.onerror = (err) => {
                console.error('[useVoxAudio] ❌ SSE connection error:', err);
                closeSSE();
                setVoxState(s => ({ ...s, status: 'error', error: 'SSE connection lost' }));
            };
        } catch (err: any) {
            console.error('[useVoxAudio] ❌ processAndListen CATCH:', err);
            setVoxState({ status: 'error', progress: 0, error: err.message, stemsAvailable: false });
        } finally {
            isProcessingRef.current = false;
        }
    }, [closeSSE]);

    // ── Preload .wav stems into AudioBuffers ─────────────────

    const preloadStems = async (folderName: string) => {
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            console.log('[useVoxAudio] Preloading stems into Web Audio RAM…');

            const [vocRes, accRes] = await Promise.all([
                fetch(`${STEMS_BASE}/${encodeURIComponent(folderName)}/vocals.wav`),
                fetch(`${STEMS_BASE}/${encodeURIComponent(folderName)}/accompaniment.wav`),
            ]);

            if (!vocRes.ok || !accRes.ok) {
                throw new Error(`Stem fetch failed: vocals=${vocRes.status}, accompaniment=${accRes.status}`);
            }

            const [vocBuf, accBuf] = await Promise.all([
                vocRes.arrayBuffer(),
                accRes.arrayBuffer(),
            ]);

            buffers.current.vocals = await ctx.decodeAudioData(vocBuf);
            buffers.current.accompaniment = await ctx.decodeAudioData(accBuf);

            console.log('[useVoxAudio] ✅ Buffers decoded successfully');

            // Ensure GainNodes exist (they persist across play/pause cycles)
            if (!gainNodes.current.vocals) {
                gainNodes.current.vocals = ctx.createGain();
                gainNodes.current.vocals.connect(ctx.destination);
                gainNodes.current.vocals.gain.value = 0;
            }
            if (!gainNodes.current.accompaniment) {
                gainNodes.current.accompaniment = ctx.createGain();
                gainNodes.current.accompaniment.connect(ctx.destination);
                gainNodes.current.accompaniment.gain.value = 0;
            }
        } catch (err: any) {
            console.error('[useVoxAudio] Preload error:', err);
            setVoxState(s => ({
                ...s,
                status: 'error',
                error: `Stem preload failed: ${err.message}`,
                stemsAvailable: false,
            }));
        }
    };

    // ── Legacy helper (getStemUrl) ───────────────────────────

    const getStemUrl = useCallback(async (song: any, type: string) => {
        const fp = song?.archivo || song?.file_path || song?.filepath || song?.local_path || song?.localPath;
        if (!fp) return null;
        const folder = fp.split('/').pop()?.replace(/\.[^/.]+$/, '');
        if (!folder) return null;
        const stemFile = type === 'vocals' ? 'vocals.wav' : 'accompaniment.wav';
        const url = `${STEMS_BASE}/${encodeURIComponent(folder)}/${stemFile}`;
        try {
            const check = await fetch(url, { method: 'HEAD' });
            return check.ok ? url : null;
        } catch {
            return null;
        }
    }, []);

    // ── Public API ───────────────────────────────────────────

    return {
        voxState,
        processAndListen,
        startStems,
        stopStems,
        setActiveType,
        checkDrift,
        getStemUrl,
    };
}
