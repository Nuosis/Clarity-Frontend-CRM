import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../layout/AppLayout';

export default function TaskTimer({
  task,
  onStart = () => {},
  onPause = () => {},
  onStop = () => {},
  onAdjust = () => {},
}) {
  const { darkMode } = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [description, setDescription] = useState('');
  const [showStopDialog, setShowStopDialog] = useState(false);

  // Update elapsed time while timer is running
  useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Format time as HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle keyboard events for CMD+stop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && isRunning) {
        e.preventDefault();
        handleStop(true); // Stop and save immediately
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning]);

  // Timer controls
  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    setStartTime(new Date());
    onStart();
  };

  const handlePause = () => {
    setIsPaused(true);
    onPause();
  };

  const handleResume = () => {
    setIsPaused(false);
    onPause();
  };

  const handleStop = (saveImmediately = false) => {
    if (saveImmediately) {
      onStop(true);
      setIsRunning(false);
      setIsPaused(false);
      setElapsedTime(0);
      setDescription('');
    } else {
      setShowStopDialog(true);
    }
  };

  const handleStopConfirm = () => {
    onStop(false, description);
    setShowStopDialog(false);
    setIsRunning(false);
    setIsPaused(false);
    setElapsedTime(0);
    setDescription('');
  };

  // Time adjustment
  const adjustTime = (minutes) => {
    const adjustment = minutes * 60;
    setElapsedTime(prev => Math.max(0, prev + adjustment));
    onAdjust(minutes);
  };

  return (
    <div className={`
      p-4 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-mono font-bold mb-2">
          {formatTime(elapsedTime)}
        </div>
        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {task.task}
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex justify-center space-x-2 mb-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                Pause
              </button>
            )}
            <button
              onClick={() => handleStop()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Time Adjustment */}
      {isRunning && (
        <div className="flex justify-center space-x-2 mb-4">
          <button
            onClick={() => adjustTime(-6)}
            className={`
              px-3 py-1 rounded-md text-sm
              ${darkMode 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-gray-200 hover:bg-gray-300'}
            `}
          >
            -6 min
          </button>
          <button
            onClick={() => adjustTime(6)}
            className={`
              px-3 py-1 rounded-md text-sm
              ${darkMode 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-gray-200 hover:bg-gray-300'}
            `}
          >
            +6 min
          </button>
        </div>
      )}

      {/* Stop Dialog */}
      {showStopDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className={`
            p-6 rounded-lg max-w-md w-full mx-4
            ${darkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <h3 className="text-lg font-semibold mb-4">Stop Timer</h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className={`
                w-full p-2 rounded-md border mb-4
                ${darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'}
              `}
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowStopDialog(false)}
                className={`
                  px-4 py-2 rounded-md
                  ${darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-200 hover:bg-gray-300'}
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleStopConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save & Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}