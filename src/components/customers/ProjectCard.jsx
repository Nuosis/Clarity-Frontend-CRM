import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Project card component
function ProjectCard({
  project,
  darkMode,
  onSelect,
  setLoading
}) {
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
      
      <div className="space-y-2">
        {project.estOfTime && (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Estimated Time: {project.estOfTime}
          </p>
        )}
      </div>
    </div>
  );
}

ProjectCard.propTypes = {
  project: PropTypes.shape({
    projectName: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    estOfTime: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired
};

export default React.memo(ProjectCard);