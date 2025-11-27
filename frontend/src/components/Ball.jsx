import React from 'react';

const Ball = ({ num, color, zodiac, size = 'md', isSpec = false }) => {
  // 3D 质感颜色映射
  const colorStyles = {
    red: 'bg-gradient-to-br from-red-400 via-red-500 to-red-700 shadow-red-900/50',
    green: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 shadow-emerald-900/50',
    blue: 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 shadow-blue-900/50',
  };

  // 尺寸配置
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl', // 特码超大
  };

  const ballClass = colorStyles[color] || 'bg-gray-400';
  const sizeClass = sizes[size];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`
        ${sizeClass} ${ballClass}
        rounded-full flex items-center justify-center text-white font-bold font-mono
        shadow-lg relative overflow-hidden transform transition-transform hover:scale-105
      `}>
        {/* 高光反射效果 (让球看起来是圆的) */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-full blur-[1px]"></div>
        
        {/* 数字 */}
        <span className="relative z-10 drop-shadow-md">
          {String(num).padStart(2, '0')}
        </span>

        {/* 特码金标 */}
        {isSpec && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
            <span className="text-[8px] text-yellow-900 font-black">特</span>
          </div>
        )}
      </div>
      
      {/* 生肖标签 */}
      <span className={`
        text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded-md text-center
        ${size === 'sm' ? 'text-[10px]' : 'text-xs'}
      `}>
        {zodiac}
      </span>
    </div>
  );
};

export default Ball;