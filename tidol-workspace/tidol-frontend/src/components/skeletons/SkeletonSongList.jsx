import React from 'react';

const SkeletonSongList = ({ count = 10 }) => {
    return (
        <div className="w-full space-y-3">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="flex items-center p-3 rounded-xl bg-white/5 border border-white/5 animate-pulse">
                    <div className="w-14 h-14 bg-white/10 rounded-lg mr-4 flex-shrink-0"></div>
                    <div className="flex-1 space-y-3">
                        <div className="h-4 bg-white/10 rounded-md w-1/3"></div>
                        <div className="h-3 bg-white/5 rounded-md w-1/4"></div>
                    </div>
                    <div className="hidden md:block w-24 h-4 bg-white/5 rounded-md mx-4"></div>
                    <div className="w-8 h-8 bg-white/5 rounded-full ml-4"></div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonSongList;
