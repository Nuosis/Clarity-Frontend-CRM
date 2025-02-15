import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

// Memoized timer display component
const TimerDisplay = React.memo(function TimerDisplay({ time, darkMode }) {
    const formattedTime = useMemo(() => {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = time % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [time]);

    return (
        <div className="text-3xl font-mono font-bold mb-2">
            {formattedTime}
        </div>
    );
});

TimerDisplay.propTypes = {
    time: PropTypes.number.isRequired,
    darkMode: PropTypes.bool.isRequired
};

// Memoized timer controls component
const TimerControls = React.memo(function TimerControls({
    isRunning,
    isPaused,
    darkMode,
    onStart,
    onPause,
    onResume,
    onStop
}) {
    return (
        <div className="flex justify-center space-x-2 mb-4">
            {!isRunning ? (
                <button
                    onClick={onStart}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                    Start
                </button>
            ) : (
                <>
                    {isPaused ? (
                        <button
                            onClick={onResume}
                            className="px-4 py-2 bg-bg-[#004967] text-white rounded-md hover:bg-blue-700"
                        >
                            Resume
                        </button>
                    ) : (
                        <button
                            onClick={onPause}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                        >
                            Pause
                        </button>
                    )}
                    <button
                        onClick={onStop}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        Stop
                    </button>
                </>
            )}
        </div>
    );
});

TimerControls.propTypes = {
    isRunning: PropTypes.bool.isRequired,
    isPaused: PropTypes.bool.isRequired,
    darkMode: PropTypes.bool.isRequired,
    onStart: PropTypes.func.isRequired,
    onPause: PropTypes.func.isRequired,
    onResume: PropTypes.func.isRequired,
    onStop: PropTypes.func.isRequired
};

// Main TaskTimer component
function TaskTimer({
    task,
    timer,
    onStart,
    onPause,
    onStop,
    onAdjust
}) {
    const { darkMode } = useTheme();
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [description, setDescription] = useState('');
    const [showStopDialog, setShowStopDialog] = useState(false);

    // Reset timer when task changes
    useEffect(() => {
        setIsRunning(false);
        setIsPaused(false);
        setElapsedTime(0);
        setDescription('');
        setShowStopDialog(false);
    }, [task?.id]);

    // Update elapsed time
    useEffect(() => {
        let interval;
        if (isRunning && !isPaused) {
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, isPaused]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 's' && (e.metaKey || e.ctrlKey) && isRunning) {
                e.preventDefault();
                handleStop(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRunning]);

    // Memoized handlers
    const handleStart = useCallback(() => {
        setIsRunning(true);
        setIsPaused(false);
        onStart();
    }, [onStart]);

    const handlePause = useCallback(() => {
        setIsPaused(true);
        onPause();
    }, [onPause]);

    const handleResume = useCallback(() => {
        setIsPaused(false);
        onPause();
    }, [onPause]);

    const handleStop = useCallback((saveImmediately = false) => {
        if (saveImmediately) {
            onStop(true);
            setIsRunning(false);
            setIsPaused(false);
            setElapsedTime(0);
            setDescription('');
        } else {
            setShowStopDialog(true);
        }
    }, [onStop]);

    const handleStopConfirm = useCallback(() => {
        onStop(false, description);
        setShowStopDialog(false);
        setIsRunning(false);
        setIsPaused(false);
        setElapsedTime(0);
        setDescription('');
    }, [onStop, description]);

    const handleAdjustTime = useCallback((minutes) => {
        const adjustment = minutes * 60;
        setElapsedTime(prev => Math.max(0, prev + adjustment));
        onAdjust(minutes);
    }, [onAdjust]);

    return (
        <div className={`
            p-4 rounded-lg border
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
            {/* Timer Display */}
            <div className="text-center mb-4">
                <TimerDisplay time={elapsedTime} darkMode={darkMode} />
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {task.task}
                </div>
            </div>

            {/* Timer Controls */}
            <TimerControls
                isRunning={isRunning}
                isPaused={isPaused}
                darkMode={darkMode}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={() => handleStop()}
            />

            {/* Time Adjustment */}
            {isRunning && (
                <div className="flex justify-center space-x-2 mb-4">
                    <button
                        onClick={() => handleAdjustTime(-6)}
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
                        onClick={() => handleAdjustTime(6)}
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
                                className="px-4 py-2 bg-bg-[#004967] text-white rounded-md hover:bg-blue-700"
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

TaskTimer.propTypes = {
    task: PropTypes.shape({
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        type: PropTypes.string,
        description: PropTypes.string,
        isCompleted: PropTypes.bool.isRequired
    }).isRequired,
    timer: PropTypes.shape({
        recordId: PropTypes.string.isRequired,
        startTime: PropTypes.instanceOf(Date).isRequired,
        isPaused: PropTypes.bool.isRequired,
        adjustment: PropTypes.number
    }),
    onStart: PropTypes.func.isRequired,
    onPause: PropTypes.func.isRequired,
    onStop: PropTypes.func.isRequired,
    onAdjust: PropTypes.func.isRequired
};

TaskTimer.defaultProps = {
    timer: null
};

export default React.memo(TaskTimer);