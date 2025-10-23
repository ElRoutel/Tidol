export function getAlbumIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

export function formatBitrate(bit_rate) {
    return bit_rate ? Math.round(bit_rate / 1000) : 0;
}
