// progress.js
import { formatTime } from './utils.js';

export function initProgress(audio, progress, currentTimeEl, durationEl) {
  audio.addEventListener('timeupdate', () => {
    const dur = audio.duration || 0;
    progress.value = dur ? (audio.currentTime / dur) * 100 : 0;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(dur);
  });

  progress.addEventListener('input', () => {
    audio.currentTime = (progress.value / 100) * audio.duration;
  });
}
