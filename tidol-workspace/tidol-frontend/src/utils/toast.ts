// src/utils/toast.ts
type ToastVariant = 'info' | 'error';

const BASE =
    'fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-fade-in pointer-events-none transition-all duration-500';

const RING: Record<ToastVariant, string> = {
    info: 'border border-[#1db954]/50',
    error: 'border border-red-500/60',
};

const LABEL: Record<ToastVariant, string> = {
    info: 'text-[#1db954] font-bold',
    error: 'text-red-400 font-bold',
};

/**
 * Aviso efímero. El mensaje se inserta como texto, nunca como HTML: los títulos
 * de pista vienen de fuentes remotas.
 */
export function showToast(message: string, variant: ToastVariant = 'info', label?: string): void {
    if (typeof document === 'undefined') return;

    const el = document.createElement('div');
    el.className = `${BASE} ${RING[variant]}`;

    if (label) {
        const prefix = document.createElement('span');
        prefix.className = LABEL[variant];
        prefix.textContent = label;
        el.appendChild(prefix);
        el.appendChild(document.createTextNode(' '));
    }
    el.appendChild(document.createTextNode(message));

    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
    setTimeout(() => el.remove(), 3000);
}
