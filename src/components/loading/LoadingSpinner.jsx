import React from 'react';

const LoadingSpinner = ({ size = 'md', color = 'cyan-500' }) => {
  // Size variants
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  // Check if color is a Tailwind class or custom color
  const isTailwindColor = !color.startsWith('#') && !color.startsWith('rgb');
  const borderColorClass = isTailwindColor ? `border-${color}` : '';

  return (
    <div className="flex justify-center items-center">
      <div
        className={`${sizeClasses[size]} border-4 border-t-transparent rounded-full animate-spin ${borderColorClass}`}
        style={!isTailwindColor ? { 
          borderColor: color,
          borderTopColor: 'transparent'
        } : {}}
      />
    </div>
  );
};

export default LoadingSpinner;
