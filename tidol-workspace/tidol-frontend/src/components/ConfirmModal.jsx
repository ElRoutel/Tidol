// src/components/ConfirmModal.jsx
// Modal controlado de confirmación. Reemplaza window.confirm, que en modo
// PWA/standalone queda bloqueado igual que window.prompt (ver PlaylistNameModal).
import { IoClose } from 'react-icons/io5';

export default function ConfirmModal({
  isOpen,
  title = '¿Estás seguro?',
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-[#181818] border border-white/10 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
            aria-label="Cerrar"
          >
            <IoClose size={22} />
          </button>
        </div>

        {message && <p className="text-white/60 text-sm leading-relaxed">{message}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full text-sm font-semibold text-gray-300 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${destructive
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-green-500 text-black hover:bg-green-400'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
