import React from 'react';

const SkeletonSongList = ({ count = 10 }) => {
    return (
        <div className="w-full space-y-2 animate-pulse">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="flex items-center p-2 rounded-lg bg-white/5">
                    {/* Cover */}
                    <div className="w-12 h-12 bg-white/10 rounded-md mr-4 flex-shrink-0"></div>

                    {/* Text Info */}
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-1/3"></div>
                        <div className="h-3 bg-white/5 rounded w-1/4"></div>
                    </div>

                    {/* Duration / Actions */}
                    <div className="w-8 h-8 bg-white/5 rounded-full ml-4"></div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonSongList;
