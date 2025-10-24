// progress.js

// Convierte segundos a mm:ss
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

export function initProgress(audio, progressBar, currentTimeEl, durationEl) {
  if (!progressBar || !currentTimeEl || !durationEl) return;

  progressBar.addEventListener('input', e => {
    const value = e.target.value;
    audio.currentTime = (value / 100) * audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
      currentTimeEl.textContent = formatTime(audio.currentTime);
      durationEl.textContent = formatTime(audio.duration);
    }
  });
}
