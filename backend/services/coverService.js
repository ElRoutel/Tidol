import axios from 'axios';

export const getBestCover = async (archiveId) => {
  // Fallback por si no hay portada
  const fallbackUrl = `https://archive.org/services/img/${archiveId}`;

  try {
    const apiUrl = `https://archive.org/metadata/${archiveId}`;
    const res = await axios.get(apiUrl);
    const metadata = res.data;

    if (!metadata || !metadata.files) return fallbackUrl;

    const imageFiles = metadata.files.filter(f =>
      f.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
    );

    if (imageFiles.length === 0) return fallbackUrl;

    // 📌 Archivos que NO queremos (espectrogramas y miniaturas)
    const badKeywords = ["spectrogram", "waveform", "thumb", "tiny"];
    const isBad = (name) => badKeywords.some(bad => name.toLowerCase().includes(bad));

    const scored = imageFiles.map(file => {
      const name = file.name.toLowerCase();
      let score = 0;

      // ⭐ Lo más importante: nombres pro de carátulas
      const goodNames = ["cover", "front", "folder", "art", "scan"];
      if (goodNames.some(word => name.includes(word))) score += 100;

      // 📂 Si está en subcarpeta → mayor calidad normalmente
      if (file.name.includes("/")) score += 50;

      // 🎯 Tamaño (si lo provee IA) → más grande = mejor
      const sizeInKb = parseInt(file.size, 10) / 1024;
      if (!isNaN(sizeInKb)) {
        score += Math.min(sizeInKb / 10, 150); // Ponderar tamaño
      }

      // ❌ Espectrogramas / thumbnails castigados
      if (isBad(name)) score -= 200;

      return { file, score };
    });

    // 🏆 Elegimos el mejor archivo
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].file;

    // Opción 1 (Preferida): Usar la URL universal de /download/, es más estable.
    const universalUrl = `https://archive.org/download/${archiveId}/${encodeURIComponent(best.name)}`;

    // Opción 2 (Fallback): Construir la URL directa si tenemos los datos del servidor.
    // Es más rápida pero puede romperse si IA mueve los archivos.
    if (metadata.server && metadata.dir) {
      const directUrl = `https://${metadata.server}${metadata.dir}/${encodeURIComponent(best.name)}`;
      // Podríamos devolver la 'directUrl' pero la 'universalUrl' es más segura.
      // Por ahora, nos quedamos con la universal por su robustez.
    }
console.log("Best cover URL:", universalUrl);
    return universalUrl;
  } catch (err) {
    console.error(`Error buscando portada para ${archiveId}:`, err.message);
    return fallbackUrl;
  }
};
