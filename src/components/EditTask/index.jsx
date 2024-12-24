import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import TaskForm from './TaskForm';
import TimerControls from './TimerControls';
import UserInput from '../UserInput';
import { createBillableManager } from './BillableManager';
import { createPortalManager } from './PortalManager';
import { createTaskFormManager } from './TaskFormManager';
import { createTimerManager } from './TimerManager';

const formatLocalTimestamp = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const EditTask = ({ isOpen, onClose, task, defaultProjectId }) => {
  const dispatch = useDispatch();
  const currentStaffId = useSelector(state => state.staff.currentStaffId);
  const currentBill = useSelector(state => state.billables.currentBill);
  const projectData = useSelector(state => state.project.projectData);
  
  // Initialize managers
  const billableManager = createBillableManager(dispatch);
  const portalManager = createPortalManager(dispatch);
  const taskFormManager = createTaskFormManager(dispatch);
  const timerManager = createTimerManager(dispatch);

  // State management
  const [formState, setFormState] = useState({
    taskDescription: '',
    priority: 'active',
    selectedProject: defaultProjectId || '',
    notes: [],
    images: [],
    links: [],
    isModified: false
  });

  const [timerState, setTimerState] = useState({
    showTimer: false,
    timerActive: false,
    timerStartTime: null,
    timerEndTime: null,
    minutes: 0,
    billableRecordId: null
  });

  const [showWorkInput, setShowWorkInput] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  const [error, setError] = useState(null);

  // Update timer state based on currentBill
  useEffect(() => {
    if (!currentBill) {
      setTimerState(prev => ({
        ...prev,
        showTimer: false,
        timerActive: false,
        billableRecordId: null
      }));
      return;
    }

    const recordId = currentBill.recordId || currentBill.fieldData?.__ID;
    const timeEnd = currentBill.fieldData?.TimeEnd;
    
    if (!timerState.billableRecordId || recordId !== timerState.billableRecordId) {
      setTimerState(prev => ({
        ...prev,
        showTimer: true,
        billableRecordId: recordId,
        timerActive: !timeEnd
      }));

      if (!timeEnd && currentBill.fieldData?.TimeStart) {
        const startDate = new Date(`${currentBill.fieldData.DateStart} ${currentBill.fieldData.TimeStart}`);
        setTimerState(prev => ({
          ...prev,
          timerStartTime: startDate,
          minutes: Math.floor((Date.now() - startDate.getTime()) / (1000 * 60))
        }));
      }
    }
  }, [currentBill]);

  // Initialize form with task data
  useEffect(() => {
    if (task) {
      const values = {
        taskDescription: task.fieldData.task,
        priority: task.fieldData.f_priority,
        selectedProject: task.fieldData._projectID || defaultProjectId || '',
        notes: task.portalData?.taskNotes || [],
        images: task.portalData?.taskImages || [],
        links: task.portalData?.taskLinks || []
      };
      setOriginalValues(values);
      setFormState(prev => ({
        ...prev,
        ...values,
        isModified: false
      }));
    }
  }, [task, defaultProjectId]);

  const resetStates = () => {
    setTimerState({
      showTimer: false,
      timerActive: false,
      timerStartTime: null,
      timerEndTime: null,
      minutes: 0,
      billableRecordId: null
    });
    setFormState(prev => ({
      ...prev,
      notes: [],
      images: [],
      links: [],
      isModified: false
    }));
    setShowWorkInput(false);
    setError(null);
    billableManager.clearBillable();
  };

  const handleClose = () => {
    resetStates();
    onClose();
  };

  const handleCancel = () => {
    if (formState.isModified && originalValues) {
      setFormState(prev => ({
        ...prev,
        ...originalValues,
        isModified: false
      }));
      setError(null);
    } else {
      handleClose();
    }
  };

  const handleNoteAdd = async (noteData) => {
    try {
      // Clear any previous errors
      setError(null);

      // Create optimistic note with formatted timestamp
      const optimisticNote = {
        'taskNotes::note': noteData.note,
        'taskNotes::_fkID': task?.fieldData?.__ID,
        'taskNotes::~CreationTimestamp': formatLocalTimestamp(new Date())
      };

      // Add note optimistically
      setFormState(prev => ({
        ...prev,
        notes: [optimisticNote, ...prev.notes]
      }));

      // Attempt to create the note in FileMaker
      await portalManager.addNote(noteData, task?.fieldData?.__ID, (errorMessage) => {
        setError(errorMessage);
        // Revert optimistic update on error
        setFormState(prev => ({
          ...prev,
          notes: prev.notes.filter(n => n !== optimisticNote)
        }));
      });
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleImageAdd = async (imageData) => {
    try {
      // Clear any previous errors
      setError(null);

      // Add image optimistically
      const optimisticImage = await portalManager.addImage(imageData, task?.fieldData?.__ID, (errorMessage) => {
        setError(errorMessage);
        // Revert optimistic update on error
        setFormState(prev => ({
          ...prev,
          images: prev.images.filter(img => 
            img['taskImages::fileName'] !== imageData.fileName
          )
        }));
      });

      // Update state with optimistic image
      setFormState(prev => ({
        ...prev,
        images: [optimisticImage, ...prev.images],
      }));
    } catch (error) {
      console.error('Failed to add image:', error);
      setError('Failed to upload image. Please try again.');
    }
  };

  const handleLinkAdd = async (linkData) => {
    try {
      // Clear any previous errors
      setError(null);

      // Create optimistic link
      const optimisticLink = {
        'taskLinks::link': linkData.link,
        'taskLinks::_fkID': task?.fieldData?.__ID
      };

      // Add link optimistically
      setFormState(prev => ({
        ...prev,
        links: [optimisticLink, ...prev.links]
      }));

      // Attempt to create the link in FileMaker
      await portalManager.addLink(linkData, task?.fieldData?.__ID, (errorMessage) => {
        setError(errorMessage);
        // Revert optimistic update on error
        setFormState(prev => ({
          ...prev,
          links: prev.links.filter(l => l !== optimisticLink)
        }));
      });
    } catch (error) {
      console.error('Failed to add link:', error);
    }
  };

  const handleTimerStart = async () => {
    const startTime = new Date();
    const selectedProjectData = projectData.find(p => p.fieldData.__ID === formState.selectedProject);
    const billable = await timerManager.startTimer({
      startTime,
      billableManager,
      selectedProject: formState.selectedProject,
      selectedProjectData,
      currentStaffId,
      taskId: task?.fieldData?.__ID,
      taskDescription: formState.taskDescription
    });

    if (billable) {
      // Update timer state immediately while Redux state updates
      const startDate = new Date(`${billable.fieldData.DateStart} ${billable.fieldData.TimeStart}`);
      setTimerState(prev => ({
        ...prev,
        showTimer: true,
        timerActive: true,
        timerStartTime: startDate,
        minutes: Math.floor((Date.now() - startDate.getTime()) / (1000 * 60)),
        billableRecordId: billable.recordId || billable.fieldData?.__ID
      }));
    }
  };

  // Handle timer state updates when currentBill changes
  useEffect(() => {
    if (currentBill && !timerState.timerActive) {
      const startDate = new Date(`${currentBill.fieldData.DateStart} ${currentBill.fieldData.TimeStart}`);
      const recordId = currentBill.recordId || currentBill.fieldData?.__ID;
      const elapsedMinutes = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60));

      setTimerState(prev => ({
        ...prev,
        showTimer: true,
        timerActive: !currentBill.fieldData?.TimeEnd,
        timerStartTime: startDate,
        minutes: elapsedMinutes,
        billableRecordId: recordId
      }));

      if (formState.priority !== 'active') {
        setFormState(prev => ({
          ...prev,
          priority: 'active'
        }));
      }
    }
  }, [currentBill]);

  const handleTimerStop = async () => {
    const endTime = new Date();
    await timerManager.stopTimer({
      billableRecordId: timerState.billableRecordId,
      billableManager,
      endTime,
      minutes: timerState.minutes,
      onTimerStop: () => {
        setTimerState(prev => ({
          ...prev,
          timerActive: false,
          timerEndTime: endTime
        }));
      },
      onReset: resetStates
    });
  };

  const handleTimeAdjust = async (newStartTime) => {
    await timerManager.adjustTime({
      newStartTime,
      billableRecordId: timerState.billableRecordId,
      billableManager,
      selectedProject: formState.selectedProject,
      onTimeAdjusted: ({ elapsedMinutes, startTime }) => {
        setTimerState(prev => ({
          ...prev,
          minutes: elapsedMinutes,
          timerStartTime: startTime
        }));
      }
    });
  };

  const handleFormSubmit = () => {
    taskFormManager.handleFormSubmit({
      ...formState,
      recordId: task?.recordId,
      onClose: handleClose
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto py-4">
      <div className="bg-white p-6 rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Task</h2>
          <TimerControls
            showTimer={timerState.showTimer}
            timerActive={timerState.timerActive}
            minutes={timerState.minutes}
            onStart={handleTimerStart}
            onStop={handleTimerStop}
            onMinutesChange={(minutes) => setTimerState(prev => ({ ...prev, minutes }))}
            onTimeAdjust={handleTimeAdjust}
            onSave={() => setShowWorkInput(true)}
            onSaveAndClose={async () => {
              await billableManager.finalizeBillable(timerState.billableRecordId, new Date(), formState.taskDescription);
              handleClose();
            }}
            onSaveAndDone={async () => {
              await billableManager.finalizeBillable(timerState.billableRecordId, new Date(), formState.taskDescription);
              handleClose();
            }}
          />
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {showWorkInput ? (
          <div className="mb-4">
            <UserInput
              initialValue={formState.taskDescription}
              onSubmit={async (inputValue) => {
                await billableManager.finalizeBillable(timerState.billableRecordId, timerState.timerEndTime, inputValue);
                resetStates();
              }}
              placeholder="Enter work performed"
            />
          </div>
        ) : (
          <TaskForm
            taskDescription={formState.taskDescription}
            selectedProject={formState.selectedProject}
            priority={formState.priority}
            isModified={formState.isModified}
            notes={formState.notes}
            images={formState.images}
            links={formState.links}
            onDescriptionChange={(value) => setFormState(prev => ({ ...prev, taskDescription: value }))}
            onProjectChange={(value) => setFormState(prev => ({ ...prev, selectedProject: value }))}
            onPriorityChange={(value) => setFormState(prev => ({ ...prev, priority: value }))}
            onNoteAdd={handleNoteAdd}
            onImageAdd={handleImageAdd}
            onLinkAdd={handleLinkAdd}
            onCancel={handleCancel}
            onSubmit={handleFormSubmit}
          />
        )}
      </div>
    </div>
  );
};

export default EditTask;
