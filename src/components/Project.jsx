import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Loading from './Loading';
import TaskTable from './TaskTable';
// import { setProjectData } from '../store/projectSlice';

function Project({ setUpdate }) {
  const dispatch = useDispatch();
  const { projectData, selectedProject, loading, error } = useSelector(state => state.project);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);

  // Get projectObj from FM on render
  useEffect(() => {
    if (selectedProject) {
      const updateJson = [{
        "entity": "project",
        "method": "GET",
        data: selectedProject
      }];
      setUpdate(JSON.stringify(updateJson));
    }
  }, [selectedProject]);

  // Set projectObj to FM on change
  useEffect(() => {
    if (projectData) {
      const updateJson = [{
        "entity": "project",
        "method": "UPDATE",
        projectData
      }];
      setUpdate(JSON.stringify(updateJson));
    }
  }, [projectData]);

  if (loading) {
    return <Loading message="Loading Project" />;
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  // Render if we have either a staffId or a selected project
  return (
    <div id="project-container" className="flex flex-col h-screen" style={{fontFamily: 'Helvetica Neue'}}>
      {currentStaffId && (
        <div className="mt-4 flex-grow overflow-auto">
          <TaskTable projectId={selectedProject?.id} />
        </div>
      )}
    </div>
  );
}

export default Project;
