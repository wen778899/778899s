import React from 'react';

const Ball = ({ num, color, zodiac, size = 'md', isSpec = false }) => {
  // 定义波色背景 (扁平化 + 微渐变，更像方块)
  const colorStyles = {
    red: 'bg-red-500 border-red-600 text-white',
    green: 'bg-emerald-500 border-emerald-600 text-white', // 修正绿色为 emerald 更符合彩票绿
    blue: 'bg-blue-500 border-blue-600 text-white',
  };

  // 尺寸控制
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',      // 历史列表小号
    md: 'w-9 h-9 text-sm',      // 历史列表标准
    lg: 'w-11 h-11 text-lg',    // 首页大号
    xl: 'w-14 h-14 text-2xl',   // 特码超大号
  };

  const bgClass = colorStyles[color] || 'bg-gray-400';
  const dimension = sizeClasses[size];

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 核心修改：rounded-md (方框) 代替 rounded-full (圆) */}
      <div className={`
        ${dimension} ${bgClass} 
        rounded-md shadow-sm border-b-4 
        flex items-center justify-center 
        font-bold font-mono relative
        transition-transform active:scale-95
      `}>
        {String(num).padStart(2, '0')}
        
        {/* 特码角标 */}
        {isSpec && (size === 'lg' || size === 'xl') && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] px-1.5 py-0.5 rounded-sm shadow-sm font-bold border border-white z-10 transform rotate-12">
            特
          </div>
        )}
      </div>
      
      {/* 生肖文字 */}
      <span className="text-[10px] text-gray-500 font-medium">
        {zodiac}
      </span>
    </div>
  );
};

export default Ball;