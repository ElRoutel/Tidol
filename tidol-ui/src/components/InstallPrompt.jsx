import React, { useEffect, useState } from 'react';
import { IoDownloadOutline, IoShareOutline, IoAddCircleOutline } from 'react-icons/io5';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    // 2. Detectar Android/PC
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 3. Detectar iOS (Mejorada)
    // Detectamos si es dispositivo Apple touch
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPad = userAgent.includes("ipad") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isIPhone = userAgent.includes("iphone");
    
    // ✅ FORZAR PARA PRUEBAS: Descomenta la siguiente línea para ver el cartel SIEMPRE
    // setIsIos(true); 
    
    // Detección real:
    if (isIPad || isIPhone) {
        setIsIos(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    // Si es iOS (o estamos forzándolo), mostramos las instrucciones
    if (isIos) {
      setShowIosHint(true);
      // Quitamos el timeout automático para que te de tiempo de verlo
      // setTimeout(() => setShowIosHint(false), 8000); 
      return;
    }

    // Android/PC
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
        // Si no hay prompt pero tampoco es iOS (ej: Chrome en Desktop ya instalado o Firefox),
        // Forzamos mostrar el hint de iOS como fallback para ver qué pasa
        setShowIosHint(true); 
    }
  };

  // Si ya es app nativa, no mostrar botón
  if (isStandalone) return null;

  return (
    <>
        <button 
            onClick={handleInstallClick}
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 font-bold w-full mt-auto group"
        >
            <IoDownloadOutline size={24} className="group-hover:animate-bounce" />
            <span>Instalar App</span>
        </button>

        {/* Instrucciones iOS / Fallback */}
        {showIosHint && (
            // Z-INDEX 99999 para asegurar que esté encima de TODO (incluso del player)
            <div className="fixed inset-0 z-[99999] flex items-end justify-center sm:items-center pointer-events-none">
                
                {/* Fondo oscuro clickeable para cerrar */}
                <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                    onClick={() => setShowIosHint(false)}
                />

                {/* La Tarjeta */}
                <div className="relative bg-[#1a1a1a] border border-white/10 p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm mb-0 sm:mb-auto pointer-events-auto animate-in slide-in-from-bottom duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">Instalar Tidol</h3>
                            <p className="text-xs text-gray-400">Agrégala a tu inicio para mejor experiencia</p>
                        </div>
                        <button 
                            onClick={() => setShowIosHint(false)} 
                            className="p-1 bg-white/10 rounded-full text-white hover:bg-white/20"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-blue-400 text-2xl"><IoShareOutline /></span>
                            <div className="text-sm text-gray-300">
                                <p className="font-bold text-white">1. Toca "Compartir"</p>
                                <p className="text-xs">En la barra inferior de Safari</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-gray-200 text-2xl"><IoAddCircleOutline /></span>
                            <div className="text-sm text-gray-300">
                                <p className="font-bold text-white">2. "Agregar a Inicio"</p>
                                <p className="text-xs">Desliza hacia abajo hasta encontrarlo</p>
                            </div>
                        </div>
                    </div>

                    {/* Flechita decorativa apuntando abajo (solo visible en movil portrait) */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-white/20 animate-bounce pt-4 sm:hidden">
                        ⬇
                    </div>
                </div>
            </div>
        )}
    </>
  );
}