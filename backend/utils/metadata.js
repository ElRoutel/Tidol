import mm from "music-metadata";
import path from "path";

export async function leerMetadata(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    return {
      titulo: metadata.common.title || path.basename(filePath),
      artista: metadata.common.artist || "Desconocido",
      album: metadata.common.album || "Single",
      duracion: Math.floor(metadata.format.duration || 0),
      portada: metadata.common.picture
        ? null // si trae portada, la guardaremos luego
        : "NoImageSong.png"
    };
  } catch (err) {
    return {
      titulo: path.basename(filePath),
      artista: "Desconocido",
      album: "Single",
      duracion: 0,
      portada: "NoImageSong.png"
    };
  }
}
