// songst.js
export async function loadTopSongs(artistData, token) {
    const topSongsBody = document.getElementById('songs-body');

    if (!artistData || !artistData.albums || artistData.albums.length === 0) {
        topSongsBody.innerHTML = `<tr><td colspan="4">No hay canciones disponibles.</td></tr>`;
        return;
    }

    try {
        const canciones = [];
        for (const album of artistData.albums) {
            const resAlbum = await fetch(`/api/albums/${album.id}/canciones`, { headers: { 'x-token': token } });
            const albumSongs = await resAlbum.json();
            canciones.push(...albumSongs);
        }

        canciones.sort((a, b) => b.duracion - a.duracion);
        const top10 = canciones.slice(0, 10);

        topSongsBody.innerHTML = '';
        top10.forEach((c, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${c.titulo}</td>
                <td>${c.album}</td>
                <td>${formatDuration(c.duracion)}</td>
                <td><audio controls src="${c.url}"></audio></td>
            `;
            topSongsBody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        topSongsBody.innerHTML = `<tr><td colspan="4">Error cargando canciones.</td></tr>`;
    }
}

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
}
