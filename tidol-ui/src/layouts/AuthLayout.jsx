import React from 'react';
import { Outlet } from 'react-router-dom';
import '../styles/glass.css';

export default function AuthLayout() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse delay-1000"></div>
            </div>

            {/* Content Container - REMOVED glass-card wrapper that was blocking interactions */}
            <div className="w-full max-w-md p-6 relative z-10">
                <div className="auth-card">
                    <div className="flex flex-col items-center mb-8">
                        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
                            Tidol
                        </h1>
                        <p className="text-gray-400 text-sm">Tu música, elevada.</p>
                    </div>

                    <Outlet />
                </div>
            </div>
        </div>
    );
}
