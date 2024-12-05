import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTaskData } from '../../store/taskSlice';
import TaskForm from './TaskForm';
import TimerControls from './TimerControls';
import UserInput from '../UserInput';
import { createBillableManager } from './BillableManager';
import { validateTimeAdjustment, calculateElapsedMinutes } from './TimeManager';

const EditTask = ({ isOpen, onClose, onSubmit, task, defaultProjectId }) => {
  const dispatch = useDispatch();
  const currentStaffId = useSelector(state => state.staff.currentStaffId);
  const currentBill = useSelector(state => state.billables.currentBill);
  const billableManager = createBillableManager(dispatch);

  // State management
  const [billableRecordId, setBillableRecordId] = useState(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [priority, setPriority] = useState('active');
  const [selectedProject, setSelectedProject] = useState(defaultProjectId || '');
  const [showTimer, setShowTimer] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState(null);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [minutes, setMinutes] = useState(0);
  const [showWorkInput, setShowWorkInput] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);

  // Update timer state based on currentBill
  useEffect(() => {
    if (currentBill) {
      const recordId = currentBill.recordId || currentBill.fieldData?.__ID;
      const timeEnd = currentBill.fieldData?.TimeEnd;
      
      // Only update if we don't have a record ID or if it's different
      if (!billableRecordId || recordId !== billableRecordId) {
        setBillableRecordId(recordId);
        setShowTimer(true);
        
        // If TimeEnd is empty, this is an active timer
        if (!timeEnd) {
          console.log('Setting active timer state from currentBill');
          setTimerActive(true);
          // Calculate elapsed minutes from the start time
          if (currentBill.fieldData?.TimeStart) {
            const startDate = new Date(`${currentBill.fieldData.DateStart} ${currentBill.fieldData.TimeStart}`);
            const elapsedMinutes = calculateElapsedMinutes(startDate.getTime());
            setMinutes(elapsedMinutes);
            setTimerStartTime(startDate);
          }
        } else {
          setTimerActive(false);
        }
      }
    }
  }, [currentBill, billableRecordId]);

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

  const resetStates = () => {
    setShowTimer(false);
    setTimerActive(false);
    setTimerStartTime(null);
    setTimerEndTime(null);
    setMinutes(0);
    setShowWorkInput(false);
    setBillableRecordId(null);
    billableManager.clearBillable();
  };

  const handleClose = () => {
    resetStates();
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

  const handleTimerStart = async () => {
    const startTime = new Date();
    setShowTimer(true);
    setTimerActive(true);
    setTimerStartTime(startTime);
    if (priority !== 'active') {
      setPriority('active');
    }

    const billable = await billableManager.createBillableRecord({
      projectId: selectedProject,
      staffId: currentStaffId,
      taskId: task?.fieldData?.__ID,
      startTime,
      description: taskDescription
    });

    if (billable) {
      const newRecordId = billable.recordId || billable.fieldData?.__ID;
      setBillableRecordId(newRecordId);
      const elapsedMinutes = calculateElapsedMinutes(startTime.getTime());
      setMinutes(elapsedMinutes);

      // Call FileMaker script with project ID
      const paramObject = { id: selectedProject };
      FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));
    }
  };

  const handleTimerStop = async () => {
    const endTime = new Date();
    setTimerActive(false);
    setTimerEndTime(endTime);

    if (billableRecordId) {
      await billableManager.updateBillableRecord(billableRecordId, {
        TimeEnd: endTime
      });
    }

    if (minutes === 0) {
      resetStates();
    }
  };

  const handleTimeAdjust = async (newStartTime) => {
    if (!validateTimeAdjustment(newStartTime) || !billableRecordId) return;

    const startDate = new Date(newStartTime);
    const updatedBill = await billableManager.updateStartTime(billableRecordId, startDate);
    
    if (updatedBill) {
      const elapsedMinutes = calculateElapsedMinutes(newStartTime);
      setMinutes(elapsedMinutes);
      setTimerStartTime(startDate);

      const paramObject = { id: selectedProject };
      FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));
    }
  };

  const handleSave = () => {
    setShowWorkInput(true);
  };

  const handleSaveAndClose = async () => {
    await billableManager.finalizeBillable(billableRecordId, new Date(), taskDescription);
    handleClose();
  };

  const handleSaveAndDone = async () => {
    await billableManager.finalizeBillable(billableRecordId, new Date(), taskDescription);
    
    if (task?.recordId) {
      await dispatch(fetchTaskData({
        action: "update",
        recordId: task.recordId,
        fieldData: {
          f_completed: 1
        }
      }));
    }

    handleClose();
  };

  const handleWorkInputSubmit = async (inputValue) => {
    await billableManager.finalizeBillable(billableRecordId, timerEndTime, inputValue);
    resetStates();
  };

  const handleFormSubmit = () => {
    onSubmit({ 
      task: taskDescription, 
      priority, 
      projectId: selectedProject,
      recordId: task?.recordId
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Task</h2>
          <TimerControls
            showTimer={showTimer}
            timerActive={timerActive}
            minutes={minutes}
            onStart={handleTimerStart}
            onStop={handleTimerStop}
            onMinutesChange={setMinutes}
            onTimeAdjust={handleTimeAdjust}
            onSave={handleSave}
            onSaveAndClose={handleSaveAndClose}
            onSaveAndDone={handleSaveAndDone}
          />
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
          <TaskForm
            taskDescription={taskDescription}
            selectedProject={selectedProject}
            priority={priority}
            isModified={isModified}
            onDescriptionChange={setTaskDescription}
            onProjectChange={setSelectedProject}
            onPriorityChange={setPriority}
            onCancel={handleCancel}
            onSubmit={handleFormSubmit}
          />
        )}
      </div>
    </div>
  );
};

export default EditTask;
