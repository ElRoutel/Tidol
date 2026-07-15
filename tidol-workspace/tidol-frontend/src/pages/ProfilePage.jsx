import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IoLogOutOutline,
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoTrashOutline,
} from "react-icons/io5";
import api from "../api/axiosConfig";
import "../styles/glass.css";

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete("/auth/me");
      logout();
      navigate("/login");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data ||
        "No se pudo eliminar la cuenta. Inténtalo de nuevo.";
      setDeleteError(typeof message === "string" ? message : JSON.stringify(message));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-8 pb-40 max-w-4xl mx-auto animate-fade-in">
      {/* Header Card */}
      <div className="glass-card p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8 mb-8 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-900/20 to-blue-900/20 pointer-events-none" />

        {/* Avatar */}
        <div className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center shadow-2xl border-4 border-white/10">
          {user.profile_img ? (
            <img src={user.profile_img} alt={user.username} className="w-full h-full rounded-full object-cover" />
          ) : (
            <IoPersonCircleOutline className="text-6xl text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 text-center md:text-left flex-1">
          <h1 className="text-4xl font-bold text-white mb-2">{user.username}</h1>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm text-gray-300">
            {user.role === 'admin' ? 'Administrador' : 'Proximamente configuraciones y demas'}
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium transition-all hover:scale-105"
          >
            <IoLogOutOutline size={20} />
            Cerrar Sesión
          </button>
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all disabled:opacity-60"
              >
                <IoTrashOutline size={18} />
                {deleting ? "Eliminando…" : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 font-medium transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-transparent hover:bg-red-500/10 border border-red-500/30 text-red-400/80 font-medium transition-all hover:scale-105"
            >
              <IoTrashOutline size={20} />
              Eliminar cuenta
            </button>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="mb-8 -mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {deleteError}
        </div>
      )}

      {/* Aún no implementado: sin `cursor-pointer` ni hover, que prometían un clic
          que no existe. Cuando haya destino, devolverle la interactividad. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl opacity-60" aria-disabled="true">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
              <IoSettingsOutline size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white">Configuración</h3>
            <span className="ml-auto text-[11px] uppercase tracking-wider text-white/40 border border-white/15 rounded-full px-2 py-0.5">
              Próximamente
            </span>
          </div>
          <p className="text-gray-400 text-sm">Gestiona tus preferencias de cuenta y reproducción.</p>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
