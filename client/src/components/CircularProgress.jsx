import React from 'react';

export default function CircularProgress({ percent, size = 120, strokeWidth = 8, label, value, isDark }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                {/* 背景圆环 */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={isDark ? '#374151' : '#E5E7EB'}
                    strokeWidth={strokeWidth}
                />
                {/* 进度圆环 */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                />
                {/* 渐变定义 */}
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                </defs>
            </svg>

            {/* 中心文字 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {percent}%
                </div>
                {label && (
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {label}
                    </div>
                )}
                {value && (
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {value}
                    </div>
                )}
            </div>
        </div>
    );
}
