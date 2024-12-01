import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Timer from './Timer';
import UserInput from './UserInput';
import { fetchBillablesData, clearCurrentBill } from '../store/billablesSlice';
import { fetchTaskData } from '../store/taskSlice';

const EditTask = ({ isOpen, onClose, onSubmit, task, defaultProjectId }) => {
  const dispatch = useDispatch();
  const [taskDescription, setTaskDescription] = useState('');
  const [priority, setPriority] = useState('active');
  const [selectedProject, setSelectedProject] = useState(defaultProjectId || '');
  const [showTimer, setShowTimer] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState(null);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [minutes, setMinutes] = useState(0);
  const [showWorkInput, setShowWorkInput] = useState(false);
  const [workPerformed, setWorkPerformed] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  
  const projectData = useSelector(state => state.project.projectData);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);
  const currentBill = useSelector(state => state.billables.currentBill);

  // Store original values when task changes
  useEffect(() => {
    if (task) {
      const values = {
        taskDescription: task.fieldData.task,
        priority: task.fieldData.f_priority,
        selectedProject: task.fieldData._projectID || defaultProjectId || ''
      };
      setOriginalValues(values);
      setTaskDescription(values.taskDescription);
      setPriority(values.priority);
      setSelectedProject(values.selectedProject);
      setIsModified(false);
    }
  }, [task, defaultProjectId]);

  // Check for modifications
  useEffect(() => {
    if (originalValues) {
      const isChanged = 
        taskDescription !== originalValues.taskDescription ||
        priority !== originalValues.priority ||
        selectedProject !== originalValues.selectedProject;
      setIsModified(isChanged);
    }
  }, [taskDescription, priority, selectedProject, originalValues]);

  // Calculate initial minutes if there's a current bill
  useEffect(() => {
    if (currentBill?.fieldData) {
      const startDateTime = new Date(`${currentBill.fieldData.DateStart} ${currentBill.fieldData.TimeStart}`);
      const elapsedMinutes = Math.floor((Date.now() - startDateTime.getTime()) / 60000);
      setMinutes(elapsedMinutes);
      setTimerStartTime(startDateTime);
      setShowTimer(true);
      setTimerActive(true);
    }
  }, [currentBill]);

  const resetTimerStates = () => {
    setShowTimer(false);
    setTimerActive(false);
    setTimerStartTime(null);
    setTimerEndTime(null);
    setMinutes(0);
    setShowWorkInput(false);
    setWorkPerformed('');
    dispatch(clearCurrentBill());
  };

  const handleClose = () => {
    resetTimerStates();
    onClose();
  };

  const handleCancel = () => {
    if (isModified && originalValues) {
      setTaskDescription(originalValues.taskDescription);
      setPriority(originalValues.priority);
      setSelectedProject(originalValues.selectedProject);
      setIsModified(false);
    } else {
      handleClose();
    }
  };

  const formatDate = (date) => {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleTimerStart = async () => {
    const startTime = new Date();
    setShowTimer(true);
    setTimerActive(true);
    setTimerStartTime(startTime);
    if (priority !== 'active') {
      setPriority('active');
    }

    // Create initial billable record with start time
    await dispatch(fetchBillablesData({
      action: 'create',
      fieldData: {
        _projectID: selectedProject,
        _staffID: currentStaffId,
        DateStart: formatDate(startTime),
        TimeStart: formatTime(startTime),
        ["Work Performed"]: taskDescription
      }
    }));

    const paramObject = {
      ...task,
      id: task.fieldData._projectID
    };
    FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));
  };

  const handleTimerStop = () => {
    setTimerActive(false);
    setTimerEndTime(new Date());
    // If less than a minute has passed, reset timer states
    if (minutes === 0) {
      resetTimerStates();
    }
  };

  const handleMinutesChange = (newMinutes) => {
    setMinutes(newMinutes);
  };

  const handleTimeAdjust = async (newStartTime) => {
    // Only update the billable record when time is manually adjusted
    if (currentBill?.recordId) {
      const startDate = new Date(newStartTime);
      await dispatch(fetchBillablesData({
        action: "update",
        recordId: currentBill.recordId,
        fieldData: {
          DateStart: formatDate(startDate),
          TimeStart: formatTime(startDate)
        }
      }));
    }
  };

  const handleSave = () => {
    setShowWorkInput(true);
  };

  const handleSaveAndClose = async () => {
    const now = new Date();
    
    // Update billable record with end time
    if (currentBill?.recordId) {
      await dispatch(fetchBillablesData({
        action: "update",
        recordId: currentBill.recordId,
        fieldData: {
          TimeEnd: formatTime(now),
          ["Work Performed"]: taskDescription
        }
      }));
    }

    // Reset states and close
    resetTimerStates();
    onClose();
  };

  const handleSaveAndDone = async () => {
    const now = new Date();
    
    // Update billable record with end time
    if (currentBill?.recordId) {
      await dispatch(fetchBillablesData({
        action: "update",
        recordId: currentBill.recordId,
        fieldData: {
          TimeEnd: formatTime(now),
          ["Work Performed"]: taskDescription
        }
      }));
    }

    // Mark task as complete
    if (task?.recordId) {
      await dispatch(fetchTaskData({
        action: "update",
        recordId: task.recordId,
        fieldData: {
          f_completed: 1
        }
      }));
    }

    // Reset states and close
    resetTimerStates();
    onClose();
  };

  const handleWorkInputSubmit = async (inputValue) => {
    setWorkPerformed(inputValue);
    setShowWorkInput(false);

    if (currentBill?.recordId) {
      await dispatch(fetchBillablesData({
        action: "update",
        recordId: currentBill.recordId,
        fieldData: {
          TimeEnd: formatTime(timerEndTime),
          ["Work Performed"]: inputValue
        }
      }));
    }
    
    resetTimerStates();
  };

  // Group projects by customer
  const groupedProjects = projectData?.reduce((acc, project) => {
    const customerName = project.fieldData['Customers::Name'];
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(project);
    return acc;
  }, {}) || {};

  // Sort customers alphabetically
  const sortedCustomers = Object.keys(groupedProjects).sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Task</h2>
          {!showTimer ? (
            <button
              onClick={handleTimerStart}
              className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
            >
              Start Timer
            </button>
          ) : timerActive ? (
            <div className="flex items-center gap-2">
              <Timer 
                animationStyle="pulse"
                onMinutesChange={handleMinutesChange}
                onTimeAdjust={handleTimeAdjust}
                isRunning={timerActive}
                initialMinutes={minutes}
              />
              <button
                onClick={handleTimerStop}
                className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
              >
                Stop
              </button>
            </div>
          ) : minutes > 0 && !showWorkInput ? (
            <div className="flex items-center gap-2">
              <Timer 
                animationStyle="pulse"
                initialMinutes={minutes}
                isRunning={false}
                onSave={handleSave}
                onSaveAndClose={handleSaveAndClose}
                onSaveAndDone={handleSaveAndDone}
              />
            </div>
          ) : null}
        </div>

        {showWorkInput ? (
          <div className="mb-4">
            <UserInput
              initialValue={taskDescription}
              onSubmit={handleWorkInputSubmit}
              placeholder="Enter work performed"
            />
          </div>
        ) : (
          <>
            <input
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Task description"
              className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
            />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
            >
              <option value="">Select Project</option>
              {sortedCustomers.map(customerName => (
                <optgroup key={customerName} label={customerName}>
                  {groupedProjects[customerName]
                    .sort((a, b) => a.fieldData.projectName.localeCompare(b.fieldData.projectName))
                    .map(project => (
                      <option key={project.fieldData["__ID"]} value={project.fieldData["__ID"]}>
                        {project.fieldData.projectName}
                      </option>
                    ))
                  }
                </optgroup>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2 border rounded mb-4 focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
            >
              <option value="active">Active</option>
              <option value="next">Next</option>
              <option value="shelved">Backlog</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-cyan-800 border border-cyan-800 rounded hover:bg-gray-100"
              >
                {isModified ? 'Cancel' : 'Close'}
              </button>
              {isModified && (
                <button
                  onClick={() => {
                    onSubmit({ 
                      task: taskDescription, 
                      priority, 
                      projectId: selectedProject,
                      recordId: task?.recordId
                    });
                    handleClose();
                  }}
                  className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
                >
                  Update Task
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditTask;
