import React from 'react';
import PropTypes from 'prop-types';
import TaskList from '../tasks/TaskList';

function ProjectTasksTab({
  projectId,
  tasks = [],
  onTaskSelect = () => {},
  onTaskStatusChange = () => {},
  onTaskCreate = () => {},
  onTaskUpdate = () => {}
}) {
  return (
    <TaskList
      tasks={tasks}
      projectId={projectId}
      onTaskSelect={onTaskSelect}
      onTaskStatusChange={onTaskStatusChange}
      onTaskCreate={onTaskCreate}
      onTaskUpdate={onTaskUpdate}
    />
  );
}

ProjectTasksTab.propTypes = {
  projectId: PropTypes.string.isRequired,
  tasks: PropTypes.arrayOf(PropTypes.object),
  onTaskSelect: PropTypes.func,
  onTaskStatusChange: PropTypes.func,
  onTaskCreate: PropTypes.func,
  onTaskUpdate: PropTypes.func
};

export default React.memo(ProjectTasksTab);