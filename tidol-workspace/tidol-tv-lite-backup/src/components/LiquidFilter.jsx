import React from 'react';

const LiquidFilter = () => (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
            <filter id="liquid-distortion">
                <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.01 0.01"
                    numOctaves="1"
                    result="warp"
                >
                    <animate
                        attributeName="baseFrequency"
                        dur="30s"
                        values="0.01 0.01;0.02 0.02;0.01 0.01"
                        repeatCount="indefinite"
                    />
                </feTurbulence>
                <feDisplacementMap
                    xChannelSelector="R"
                    yChannelSelector="G"
                    scale="30"
                    in="SourceGraphic"
                    in2="warp"
                />
            </filter>
        </defs>
    </svg>
);

export default LiquidFilter;
