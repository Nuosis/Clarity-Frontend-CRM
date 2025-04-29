import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import ProjectCard from './ProjectCard';

function ProjectListing({ 
  title, 
  projects, 
  onProjectSelect, 
  setLoading,
  collapsible = false,
  initiallyCollapsed = false
}) {
  const { darkMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  
  if (!projects || projects.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">{title} (0)</h3>
        <div className={`
          text-center py-8 rounded-lg border
          ${darkMode
            ? 'bg-gray-800 border-gray-700 text-gray-400'
            : 'bg-gray-50 border-gray-200 text-gray-500'}
        `}>
          No {title.toLowerCase()}
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold">{title} ({projects.length})</h3>
        {collapsible && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              px-3 py-1 text-sm rounded-md transition-colors
              ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}
            `}
          >
            {isCollapsed ? 'View' : 'Hide'}
          </button>
        )}
      </div>
      
      {!isCollapsed && (
        <div className={`max-h-[${title === 'Active Projects' ? '400px' : '300px'}] overflow-y-auto pr-2 mb-6`}>
          <div className="grid grid-cols-2 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                darkMode={darkMode}
                onSelect={onProjectSelect}
                setLoading={setLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ProjectListing.propTypes = {
  title: PropTypes.string.isRequired,
  projects: PropTypes.array.isRequired,
  onProjectSelect: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired,
  collapsible: PropTypes.bool,
  initiallyCollapsed: PropTypes.bool
};

export default ProjectListing;