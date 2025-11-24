import React from 'react';

const Ball = ({ num, color, zodiac, size = 'md' }) => {
  const colorMap = {
    red: 'bg-red-500 border-red-600',
    green: 'bg-green-500 border-green-600',
    blue: 'bg-blue-500 border-blue-600',
  };
  
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-lg' : 'w-8 h-8 text-sm';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${sizeClass} ${colorMap[color] || 'bg-gray-400'} rounded-full flex items-center justify-center text-white font-bold shadow-md border-b-4`}>
        {String(num).padStart(2, '0')}
      </div>
      <span className="text-xs text-gray-600 font-medium">{zodiac}</span>
    </div>
  );
};

export default Ball;