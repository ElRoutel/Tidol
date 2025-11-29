const toggleVox = useCallback(async () => {
    console.log('[PlayerContext] toggleVox called');
    if (!currentSong) return;

    // If active, turn off
    if (voxMode) {
        setVoxMode(false);
        return;
    }

    // If we already have tracks for this song, just turn on
    if (voxTracks && voxTracks.songId === currentSong.id) {
        setVoxMode(true);
        return;
    }

    // Call dedicated VOX separation endpoint
    setIsVoxLoading(true);
    try {
        const isIA = currentSong.url?.includes('archive.org');
        let voxEndpoint;
        let params = {};

        if (isIA) {
            voxEndpoint = '/spectra/vox/separate';
            params = { ia_id: currentSong.identifier || currentSong.id };
        } else {
            voxEndpoint = `/spectra/local/vox/separate/${currentSong.id}`;
        }

        const response = await axios.post(voxEndpoint, params);

        if (response.data.status === 'success') {
            // Stems already exist
            setVoxTracks({
                songId: currentSong.id,
                vocals: `/spectra${response.data.vocals}`,
                accompaniment: `/spectra${response.data.accompaniment}`
            });
            setVoxMode(true);
            setVoxType('accompaniment');
            setIsVoxLoading(false);
        } else if (response.data.status === 'processing') {
            // Polling for completion
            console.log('[VOX] Separation started, polling for completion...');

            const pollStems = async () => {
                try {
                    const query = isIA ? `?ia_id=${currentSong.identifier || currentSong.id}` : `?tidol_id=${currentSong.id}`;
                    const analysisResponse = await axios.get(`/spectra/analysis${query}`);

                    if (analysisResponse.data.stems) {
                        setVoxTracks({
                            songId: currentSong.id,
                            vocals: `/spectra${analysisResponse.data.stems.vocals}`,
                            accompaniment: `/spectra${analysisResponse.data.stems.accompaniment}`
                        });
                        setVoxMode(true);
                        setVoxType('accompaniment');
                        setIsVoxLoading(false);
                        console.log('[VOX] Stems ready!');
                    } else {
                        setTimeout(pollStems, 3000);
                    }
                } catch (error) {
                    console.error('[VOX] Polling error:', error);
                    setIsVoxLoading(false);
                }
            };

            pollStems();
        }
    } catch (err) {
        console.error("VOX Failed:", err);
        alert("No se pudo activar Karaoke. Intenta de nuevo.");
        setIsVoxLoading(false);
    }
}, [currentSong, voxMode, voxTracks]);
