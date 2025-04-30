import React from 'react';
import PropTypes from 'prop-types';

// Project card component
function ProjectCard({
  project,
  darkMode,
  onSelect,
  setLoading
}) {
  // Determine project type
  const getProjectType = () => {
    if (project.f_fixedPrice) return 'Fixed Cost';
    if (project.f_subscription) return 'Subscription';
    return 'Billable';
  };

  // Get appropriate badge color based on project type
  const getTypeColor = (type) => {
    switch (type) {
      case 'Fixed Cost':
        return darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800';
      case 'Subscription':
        return darkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800';
      default: // Billable
        return darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
    }
  };

  const projectType = getProjectType();
  const typeColor = getTypeColor(projectType);

  return (
    <div
      onClick={(e) => {
        setLoading(true);
        onSelect(project);
      }}
      className={`
        p-4 rounded-lg border cursor-pointer focus:outline-none
        ${darkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'}
        transition-colors duration-150
      `}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{project.projectName}</h3>
        <span className={`
          px-2 py-1 text-sm rounded-full
          ${project.status === 'Open'
            ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
            : (darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800')}
        `}>
          {project.status}
        </span>
      </div>
      
      <div className="mt-2 mb-3">
        <span className={`
          px-2 py-1 text-xs rounded-full ${typeColor}
        `}>
          {projectType}
        </span>
      </div>
      
      <div className="space-y-2">
        {/* Show estimated time for all project types */}
        {project.estOfTime && (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Estimated Time: {project.estOfTime}
          </p>
        )}
        
        {/* Show value and payment structure for fixed price projects */}
        {project.f_fixedPrice && project.value > 0 && (
          <div className="mt-2">
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Fixed Value: ${project.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              • 50% (${(project.value / 2).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}) to sellable at start
            </p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              • 50% (${(project.value / 2).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}) to sales at completion
            </p>
          </div>
        )}
        
        {/* Show value and payment structure for subscription projects */}
        {project.f_subscription && project.value > 0 && (
          <div className="mt-2">
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Monthly Value: ${project.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
          </div>
        )}
        
        {/* Show relevant dates based on project type */}
        <div className="mt-2">
          {project.dateStart && (
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {project.f_fixedPrice ? 'Start Date (50% payment):' :
               project.f_subscription ? 'Subscription Start:' :
               'Start Date:'} {new Date(project.dateStart).toLocaleDateString()}
            </p>
          )}
          
          {project.dateEnd && (
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {project.f_fixedPrice ? 'End Date (50% payment):' :
               project.f_subscription ? 'Subscription End:' :
               'End Date:'} {new Date(project.dateEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    projectName: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    estOfTime: PropTypes.string,
    f_fixedPrice: PropTypes.bool,
    f_subscription: PropTypes.bool,
    value: PropTypes.number,
    dateStart: PropTypes.string,
    dateEnd: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired
};

export default React.memo(ProjectCard);