import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTaskData, setSelectedTask } from '../store/taskSlice';
import { setCurrentBill, updateBillablesData } from '../store/billablesSlice';
import Loading from './Loading';
import AddTask from './AddTask';
import EditTask from './EditTask/index';
import TaskSection from './TaskSection';
import EmptyState from './EmptyState';

export default function TaskTable({ projectId, loadCustomer }) {
  const dispatch = useDispatch();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updateBillables, setUpdateBillables] = useState(true);
  const tasks = useSelector(state => state.task.tasks);
  const selectedTask = useSelector(state => state.task.selectedTask);
  const loading = useSelector(state => state.task.loading);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);
  const selectedCustomer = useSelector(state => state.project.selectedCustomer);
  const selectedProject = useSelector(state => state.project.selectedProject);
  const projectData = useSelector(state => state.project.projectData);
  const billablesData = useSelector(state => state.billables.billablesData);

  const fetchTasks = async () => {
    if (currentStaffId) {
      let query;
      if (selectedProject) {
        // If a project is selected, show only its tasks
        query = `[{"_staffID":"${currentStaffId}","_projectID":"${selectedProject.id}"}]`;
      } else if (selectedCustomer && projectId) {
        // If a customer is selected and we're in project view, show customer's project tasks
        query = `[{"_staffID":"${currentStaffId}","_projectID":"${projectId}"}]`;
      } else if (selectedCustomer) {
        // If only a customer is selected, show all their project tasks
        const customerProjects = projectData?.filter(p => 
          p.fieldData['Customers::Name'] === selectedCustomer
        ).map(p => p.fieldData['__ID']);
        
        if (customerProjects?.length) {
          query = JSON.stringify(customerProjects.map(projectId => ({
            _staffID: currentStaffId,
            _projectID: projectId
          })));
        } else {
          query = `[{"_staffID":"${currentStaffId}"}]`;
        }
      } else {
        // No selection, show all staff tasks
        query = `[{"_staffID":"${currentStaffId}"}]`;
      }
      
      return dispatch(fetchTaskData({
        query,
        action: "read"
      }));
    }
  };

  // Fetch tasks when component mounts or when selection changes
  useEffect(() => {
    fetchTasks();
  }, [projectId, currentStaffId, selectedCustomer, selectedProject]);

  // Update billables when updateBillables is true
  useEffect(() => {
    if (updateBillables && billablesData?.length > 0) {
      dispatch(updateBillablesData({ response: { data: billablesData } }));
      setUpdateBillables(false);
    }
  }, [updateBillables, billablesData]);

  // Check for open billables and mount task if found
  useEffect(() => {
    const checkOpenBillables = async () => {
      if (currentStaffId && billablesData?.length > 0) {
        // Filter billables for this staff member with no endTime
        const openBillables = billablesData.filter(b => 
          b.fieldData._staffID === currentStaffId && 
          b.fieldData.TimeStart && 
          !b.fieldData.TimeEnd
        );

        if (openBillables.length > 0) {
          // Sort by most recent start time
          const sortedBillables = openBillables.sort((a, b) => {
            const aDate = new Date(`${a.fieldData.DateStart} ${a.fieldData.TimeStart}`);
            const bDate = new Date(`${b.fieldData.DateStart} ${b.fieldData.TimeStart}`);
            return bDate - aDate;
          });

          // Get the most recent open billable
          const mostRecentBillable = sortedBillables[0];
          
          // Set the current bill to activate the timer
          dispatch(setCurrentBill(mostRecentBillable));
          
          // If billable has a taskID, fetch that specific task
          if (mostRecentBillable.fieldData._taskID) {
            // Fetch the specific task using taskID
            const taskResponse = await dispatch(fetchTaskData({
              action: 'read',
              query: `[{"__ID":"${mostRecentBillable.fieldData._taskID}"}]`
            }));
            
            // If task is found, set it as selected and open edit modal
            if (taskResponse.payload?.response?.data?.[0]) {
              dispatch(setSelectedTask(taskResponse.payload.response.data[0]));
              setIsEditModalOpen(true);
            }
          }
        }
      }
    };
    checkOpenBillables();
  }, [currentStaffId, billablesData]);

  // Open EditTask modal when selectedTask changes
  useEffect(() => {
    if (selectedTask) {
      setIsEditModalOpen(true);
    }
  }, [selectedTask]);

  if (loading) {
    return <Loading message="Fetching Tasks" />;
  }

  // Get the appropriate header text based on selection
  const getHeaderText = () => {
    if (selectedProject) {
      return `${selectedProject.name} Tasks`;
    }
    if (selectedCustomer) {
      return `${selectedCustomer} Tasks`;
    }
    return 'All Tasks';
  };

  // Filter tasks based on priority and completion
  const filteredTasks = tasks || [];
  const groupedTasks = {
    active: filteredTasks.filter(t => t.fieldData.f_priority === 'active' && t.fieldData.f_completed === 0),
    next: filteredTasks.filter(t => t.fieldData.f_priority === 'next' && t.fieldData.f_completed === 0),
    backlog: filteredTasks.filter(t => t.fieldData.f_priority === 'backlog' && t.fieldData.f_completed === 0)
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const newPriority = result.destination.droppableId;
    const taskId = result.draggableId;
    const task = tasks.find(t => t.recordId === taskId);

    if (task && task.fieldData.f_priority !== newPriority) {
      await dispatch(fetchTaskData({
        action: "update",
        recordId: taskId,
        fieldData: {
          f_priority: newPriority
        }
      }));
      
      // Refresh tasks after updating priority
      fetchTasks();
    }
  };

  const handleTaskComplete = async (task) => {
    await dispatch(fetchTaskData({
      action: "update",
      recordId: task.recordId,
      fieldData: {
        f_completed: task.fieldData.f_completed === 1 ? 0 : 1
      }
    }));
    
    // Refresh tasks after updating completion status
    fetchTasks();
  };

  const handleTaskClick = (task) => {
    dispatch(setSelectedTask(task));
  };

  const handleAddSubmit = async ({ task: taskName, priority, projectId: selectedProjectId, shouldActivate }) => {
    // Create the task
    await dispatch(fetchTaskData({
      action: "create",
      fieldData: {
        task: taskName,
        f_priority: priority,
        _projectID: selectedProjectId || projectId || '',
        _staffID: currentStaffId,
        f_completed: 0
      }
    }));
    
    // Fetch updated tasks and wait for the response
    const fetchResponse = await fetchTasks();
    
    // If shouldActivate is true, find the newly created task in the updated tasks list
    if (shouldActivate && fetchResponse.payload?.response?.data) {
      const updatedTasks = fetchResponse.payload.response.data;
      // Find the most recently created task matching our criteria
      const newTask = updatedTasks
        .filter(t => 
          t.fieldData.task === taskName &&
          t.fieldData._projectID === (selectedProjectId || projectId || '') &&
          t.fieldData.f_priority === priority
        )
        .sort((a, b) => {
          // Sort by creation timestamp if available, otherwise assume the last one is the newest
          if (a.fieldData.createdTimestamp && b.fieldData.createdTimestamp) {
            return new Date(b.fieldData.createdTimestamp) - new Date(a.fieldData.createdTimestamp);
          }
          return -1; // Default to the last one added
        })[0];

      if (newTask) {
        console.log('Setting selected task:', newTask);
        dispatch(setSelectedTask(newTask));
      }
    }
  };

  const handleEditSubmit = async ({ task: taskName, priority, projectId: selectedProjectId, recordId }) => {
    await dispatch(fetchTaskData({
      action: "update",
      recordId,
      fieldData: {
        task: taskName,
        f_priority: priority,
        _projectID: selectedProjectId || projectId || ''
      }
    }));
    
    dispatch(setSelectedTask(null));
    fetchTasks();
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">
            {getHeaderText()}
          </h1>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 flex gap-2">
          {selectedCustomer && (
            <button
              onClick={() => loadCustomer()}
              className="px-4 py-2 text-cyan-800 border border-cyan-800 rounded hover:bg-gray-100 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Info
            </button>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {(!tasks || tasks.length === 0) ? (
        <EmptyState />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <TaskSection 
            title="Active" 
            tasks={groupedTasks.active} 
            droppableId="active" 
            onTaskComplete={handleTaskComplete}
            onTaskClick={handleTaskClick}
          />
          <TaskSection 
            title="Next" 
            tasks={groupedTasks.next} 
            droppableId="next" 
            onTaskComplete={handleTaskComplete}
            onTaskClick={handleTaskClick}
          />
          <TaskSection 
            title="Backlog" 
            tasks={groupedTasks.backlog} 
            droppableId="backlog" 
            onTaskComplete={handleTaskComplete}
            onTaskClick={handleTaskClick}
          />
        </DragDropContext>
      )}

      <AddTask
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        defaultProjectId={projectId}
      />

      <EditTask
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          dispatch(setSelectedTask(null));
        }}
        onSubmit={handleEditSubmit}
        task={selectedTask}
        defaultProjectId={projectId}
      />
    </div>
  );
}
