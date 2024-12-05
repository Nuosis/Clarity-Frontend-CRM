import React from 'react';
import Timer from '../Timer';

const TimerControls = ({
  showTimer,
  timerActive,
  minutes,
  onStart,
  onStop,
  onMinutesChange,
  onTimeAdjust,
  onSave,
  onSaveAndClose,
  onSaveAndDone
}) => {
  if (!showTimer) {
    return (
      <button
        onClick={onStart}
        className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
      >
        Start Timer
      </button>
    );
  }

  if (timerActive) {
    return (
      <div className="flex items-center gap-2">
        <Timer 
          animationStyle="pulse"
          onMinutesChange={onMinutesChange}
          onTimeAdjust={onTimeAdjust}
          isRunning={timerActive}
          initialMinutes={minutes}
        />
        <button
          onClick={onStop}
          className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
        >
          Stop
        </button>
      </div>
    );
  }

  if (minutes > 0) {
    return (
      <div className="flex items-center gap-2">
        <Timer 
          animationStyle="pulse"
          initialMinutes={minutes}
          isRunning={false}
          onSave={onSave}
          onSaveAndClose={onSaveAndClose}
          onSaveAndDone={onSaveAndDone}
        />
      </div>
    );
  }

  return null;
};

export default TimerControls;
