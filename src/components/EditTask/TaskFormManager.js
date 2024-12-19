export const createTaskFormManager = (dispatch) => {
  const handleFormSubmit = ({ 
    taskDescription, 
    priority, 
    selectedProject,
    recordId,
    notes,
    images,
    links,
    onClose 
  }) => {
    // Handle form submission
    if (recordId) {
      dispatch({
        type: 'task/updateTask',
        payload: {
          task: taskDescription,
          priority,
          projectId: selectedProject,
          recordId,
          notes,
          images,
          links
        }
      });
    }
    onClose();
  };

  const validateForm = (formData) => {
    const { taskDescription, selectedProject } = formData;
    const errors = {};

    if (!taskDescription?.trim()) {
      errors.taskDescription = 'Task description is required';
    }

    if (!selectedProject) {
      errors.selectedProject = 'Project selection is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  return {
    handleFormSubmit,
    validateForm
  };
};
