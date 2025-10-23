// volume.js
export function initVolumeControls(audio, volumeSlider, muteBtn) {
  let lastVolume = 1;
  audio.volume = 1;
  volumeSlider.value = 1;

  function updateVolume() {
    const vol = audio.muted ? 0 : audio.volume;
    muteBtn.textContent = vol === 0 ? "🔇" : vol < 0.3 ? "🔈" : vol < 0.7 ? "🔉" : "🔊";
    volumeSlider.value = vol;
  }

  audio.addEventListener('volumechange', updateVolume);

  volumeSlider.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    audio.muted = false;
    audio.volume = vol;
    lastVolume = vol;
    updateVolume();
  });

  muteBtn.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume;
    } else {
      lastVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
    }
    updateVolume();
  });

  updateVolume();
}
