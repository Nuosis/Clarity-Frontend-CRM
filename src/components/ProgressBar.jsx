import React, { useEffect, useState } from 'react';
import { progressBarManager } from '../classes/ProgressBarManager';

const ProgressBar = ({ 
  start, 
  stop, 
  currentValue, 
  color,
  display 
}) => {
  // Use a dummy state just to trigger re-renders
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Update manager config with any provided props
    const newConfig = {};
    if (start !== undefined) newConfig.start = start;
    if (stop !== undefined) newConfig.stop = stop;
    if (currentValue !== undefined) newConfig.currentValue = currentValue;
    if (color !== undefined) newConfig.color = color;
    if (display !== undefined) newConfig.display = display;
    
    progressBarManager.updateConfig(newConfig);
  }, [start, stop, currentValue, color, display]);

  useEffect(() => {
    // Subscribe to force re-renders when config changes
    const unsubscribe = progressBarManager.subscribe(() => {
      forceUpdate({});
    });

    return () => unsubscribe();
  }, []);

  const config = progressBarManager.getConfig();
  
  // Calculate progress percentage
  const range = config.stop - config.start;
  const progressPercentage = ((config.currentValue - config.start) / range) * 100;

  return (
    <div 
      className="w-full bg-gray-100 rounded-lg overflow-hidden h-6 relative"
      style={{ backgroundColor: '#f3f4f6' }}
    >
      <div 
        className="h-full rounded-lg transition-width duration-300 ease-in-out"
        style={{ 
          width: `${progressPercentage}%`,
          backgroundColor: config.color
        }}
      />
      <div 
        className="absolute inset-0 flex items-center justify-center text-gray-800 font-medium text-sm"
        style={{ 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem'
        }}
      >
        {config.display ? `${Math.round(progressPercentage)}%` : null}
      </div>
    </div>
  );
};

export default ProgressBar;
