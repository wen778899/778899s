import React from 'react';

const Ball = ({ num, color, zodiac, size = 'md', isSpec = false }) => {
  // 定义颜色渐变样式
  const colorStyles = {
    red: 'bg-gradient-to-br from-red-400 to-red-600 shadow-ball',
    green: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-ball',
    blue: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-ball',
  };

  // 尺寸控制
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-9 h-9 text-base', // 历史记录用
    lg: 'w-12 h-12 text-xl', // 最新一期平码用
    xl: 'w-14 h-14 text-2xl', // 最新一期特码用
  };

  // 字体大小控制
  const textSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
  };

  const bgClass = colorStyles[color] || 'bg-gray-400';
  const dimension = sizeClasses[size];

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 球体 */}
      <div className={`${dimension} ${bgClass} rounded-full flex items-center justify-center text-white font-bold relative transition-transform hover:scale-105`}>
        {String(num).padStart(2, '0')}
        
        {/* 特码标记 (仅在特码且是大球时显示) */}
        {isSpec && (size === 'lg' || size === 'xl') && (
          <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] px-1 rounded-full border border-white shadow-sm font-bold z-10">
            特
          </div>
        )}
      </div>
      
      {/* 生肖文字 */}
      <span className={`${textSize[size]} text-gray-700 font-medium tracking-wide`}>
        {zodiac}
      </span>
    </div>
  );
};

export default Ball;