import React from 'react';
import PropTypes from 'prop-types';
import ProjectDetails from './ProjectDetails';
import ProjectReportButton from '../financial/ProjectReportButton';
import { useFinancialRecords } from '../../hooks/useFinancialRecords';
import { useSnackBar } from '../../context/SnackBarContext';

/**
 * Enhanced ProjectDetails component with PDF report generation functionality
 * 
 * This is an example of how to integrate the PDF report generation into
 * the existing ProjectDetails component without modifying it directly.
 */
function ProjectDetailsWithReport({
  projectId,
  tasks,
  onTaskSelect,
  onStatusChange,
  onTaskCreate,
  onTaskUpdate,
  onTaskStatusChange,
  onDelete,
  onTeamChange,
  project
}) {
  // Get financial records for the project
  const { financialRecords, loading: recordsLoading } = useFinancialRecords(project?.customerId);
  
  // Get snackbar for notifications
  const { showSuccess, showError } = useSnackBar();

  // Handle successful report generation
  const handleReportSuccess = () => {
    showSuccess('PDF report generated successfully');
  };

  // Handle report generation error
  const handleReportError = (error) => {
    showError(`Failed to generate PDF report: ${error.message}`);
  };

  return (
    <div className="relative">
      {/* Add the report button in the top-right corner */}
      <div className="absolute top-0 right-0 z-10">
        <ProjectReportButton
          projectId={project?.id}
          financialRecords={financialRecords}
          onSuccess={handleReportSuccess}
          onError={handleReportError}
          disabled={recordsLoading || !project}
        >
          Generate Project Report
        </ProjectReportButton>
      </div>
      
      {/* Render the original ProjectDetails component */}
      <ProjectDetails
        projectId={projectId}
        tasks={tasks}
        onTaskSelect={onTaskSelect}
        onStatusChange={onStatusChange}
        onTaskCreate={onTaskCreate}
        onTaskUpdate={onTaskUpdate}
        onTaskStatusChange={onTaskStatusChange}
        onDelete={onDelete}
        onTeamChange={onTeamChange}
        project={project}
      />
    </div>
  );
}

ProjectDetailsWithReport.propTypes = {
  projectId: PropTypes.string,
  tasks: PropTypes.array,
  onTaskSelect: PropTypes.func,
  onStatusChange: PropTypes.func,
  onTaskCreate: PropTypes.func,
  onTaskUpdate: PropTypes.func,
  onTaskStatusChange: PropTypes.func,
  onDelete: PropTypes.func,
  onTeamChange: PropTypes.func,
  project: PropTypes.object
};

export default ProjectDetailsWithReport;