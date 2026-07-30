export function byId(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`No se encontró el elemento #${id}`);
    return element;
}
export function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#039;',
            '"': '&quot;'
        };
        return entities[character] ?? character;
    });
}
export function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0)
        return `${days}d ${hours}h`;
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
