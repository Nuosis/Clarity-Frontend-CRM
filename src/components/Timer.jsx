import React, { useState, useEffect } from 'react';

const Timer = ({ 
  animationStyle = 'pulse',
  isRunning: externalIsRunning,
  onMinutesChange,
  onTimeAdjust,
  onSave,
  onSaveAndClose,
  onSaveAndDone,
  initialMinutes = 0
}) => {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [startTime, setStartTime] = useState(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        setIsAltPressed(true);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        setIsAltPressed(false);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize or update timer state when running state or initialMinutes changes
  useEffect(() => {
    console.log('Timer props changed:', { externalIsRunning, initialMinutes }); // Debug log
    
    if (externalIsRunning) {
      // Calculate start time based on current time minus elapsed minutes
      const calculatedStartTime = Date.now() - (initialMinutes * 60000);
      console.log('Setting start time:', new Date(calculatedStartTime).toISOString()); // Debug log
      setStartTime(calculatedStartTime);
      setMinutes(initialMinutes);
    } else if (!externalIsRunning && startTime) {
      // If timer stops, preserve the current minutes but clear start time
      setStartTime(null);
    }
  }, [externalIsRunning, initialMinutes]);

  // Timer update interval
  useEffect(() => {
    let intervalId;
    
    if (externalIsRunning && startTime) {
      console.log('Starting timer interval with startTime:', new Date(startTime).toISOString()); // Debug log
      
      intervalId = setInterval(() => {
        const now = Date.now();
        const elapsedMinutes = Math.floor((now - startTime) / 60000);
        
        // Only update if the elapsed minutes have actually changed
        if (elapsedMinutes !== minutes) {
          console.log('Updating minutes:', elapsedMinutes); // Debug log
          setMinutes(elapsedMinutes);
          if (onMinutesChange) {
            onMinutesChange(elapsedMinutes);
          }
        }
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [externalIsRunning, startTime, minutes, onMinutesChange]);

  const adjustTime = (increment) => {
    console.log('Adjusting time:', { increment, currentStartTime: startTime ? new Date(startTime).toISOString() : null }); // Debug log
    if (!startTime) {
      console.log('No start time available for adjustment'); // Debug log
      return;
    }

    const newMinutes = minutes + increment;
    if (newMinutes >= 0) {
      // Calculate new start time based on current time minus new minutes
      const now = Date.now();
      const newStartTime = now - (newMinutes * 60000);
      
      console.log('New start time calculated:', new Date(newStartTime).toISOString()); // Debug log
      setStartTime(newStartTime);
      setMinutes(newMinutes);
      
      if (onMinutesChange) {
        onMinutesChange(newMinutes);
      }
      
      // Call onTimeAdjust with the new start time
      if (onTimeAdjust) {
        console.log('Calling onTimeAdjust with:', new Date(newStartTime).toISOString()); // Debug log
        onTimeAdjust(newStartTime);
      }
    }
  };

  const handleSaveClick = () => {
    if (isAltPressed && isShiftPressed && onSaveAndDone) {
      onSaveAndDone();
    } else if (isAltPressed && onSaveAndClose) {
      onSaveAndClose();
    } else if (onSave) {
      onSave();
    }
  };

  const formatTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return (
      <span className="font-mono">
        {hours}
        <span className={`${externalIsRunning && animationStyle === 'pulse' ? 'timer-colon' : ''}`}>:</span>
        {mins.toString().padStart(2, '0')}
      </span>
    );
  };

  // Animation classes based on style prop
  const getAnimationClass = () => {
    if (!externalIsRunning) return '';
    switch (animationStyle) {
      case 'pulse':
        return ''; // We're not using the container pulse anymore
      case 'dot':
        return 'timer-dot';
      case 'border':
        return 'timer-border';
      default:
        return '';
    }
  };

  const getSaveButtonText = () => {
    if (isAltPressed && isShiftPressed) return 'Save & Done';
    if (isAltPressed) return 'Save & Close';
    return 'Save';
  };

  return (
    <div className="inline-flex items-center gap-1 bg-gray-50 p-1 rounded-lg shadow-sm">
      <button
        onClick={() => adjustTime(-6)}
        className={`
          w-7 h-7 rounded-md flex items-center justify-center
          ${minutes < 6 
            ? 'text-gray-300 cursor-not-allowed' 
            : 'text-gray-500 hover:text-cyan-800 hover:bg-white active:bg-gray-100'}
          transition-all duration-150
        `}
        disabled={minutes < 6}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
        </svg>
      </button>

      <div 
        className={`
          relative px-3 py-1.5 rounded-md 
          ${externalIsRunning ? 'bg-white shadow-sm' : 'hover:bg-white'}
          ${getAnimationClass()}
          cursor-pointer
          transition-all duration-150
          select-none
        `}
      >
        <span className={`
          text-lg tracking-wider
          ${externalIsRunning ? 'text-cyan-800 font-medium' : 'text-gray-600'}
        `}>
          {formatTime(minutes)}
        </span>
        {externalIsRunning && animationStyle === 'dot' && (
          <span className="absolute top-1/2 -right-1 w-1.5 h-1.5 rounded-full bg-cyan-500 transform -translate-y-1/2 animate-ping" />
        )}
      </div>

      <button
        onClick={() => adjustTime(6)}
        className="
          w-7 h-7 rounded-md flex items-center justify-center
          text-gray-500 hover:text-cyan-800 hover:bg-white active:bg-gray-100
          transition-all duration-150
        "
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
        </svg>
      </button>

      {!externalIsRunning && (onSave || onSaveAndClose || onSaveAndDone) && (
        <button
          onClick={handleSaveClick}
          className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 ml-2"
        >
          {getSaveButtonText()}
        </button>
      )}
    </div>
  );
};

export default Timer;
