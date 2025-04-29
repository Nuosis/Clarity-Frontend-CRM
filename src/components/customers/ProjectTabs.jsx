import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import ProjectCard from './ProjectCard';

function ProjectTabs({ 
  activeProjects, 
  closedProjects, 
  onProjectSelect, 
  setLoading 
}) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('active');
  
  return (
    <div>
      {/* Tabs */}
      <div className="flex mb-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium focus:outline-none relative ${
            activeTab === 'active'
            ? `${darkMode ? 'text-white' : 'text-gray-800'}`
            : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
          }`}
        >
          Active Projects
          {activeTab === 'active' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
          )}
        </button>
        
        {closedProjects.length > 0 && (
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 font-medium focus:outline-none relative ${
              activeTab === 'closed'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
          >
            Closed Projects
            {activeTab === 'closed' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
            )}
          </button>
        )}
      </div>
      
      {/* Tab Content */}
      <div className={`
        p-4 rounded-lg border
        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        {activeTab === 'active' && (
          <div>
            {activeProjects.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  {activeProjects.map(project => (
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
            ) : (
              <div className={`
                text-center py-8 rounded-lg
                ${darkMode
                  ? 'text-gray-400'
                  : 'text-gray-500'}
              `}>
                No active projects
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'closed' && closedProjects.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              {closedProjects.map(project => (
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
    </div>
  );
}

ProjectTabs.propTypes = {
  activeProjects: PropTypes.array.isRequired,
  closedProjects: PropTypes.array.isRequired,
  onProjectSelect: PropTypes.func.isRequired,
  setLoading: PropTypes.func.isRequired
};

export default ProjectTabs;