import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Memoized objective component
const Objective = React.memo(function Objective({
  objective,
  darkMode
}) {
  const completion = useMemo(() => {
    if (!objective.steps.length) return 0;
    const completed = objective.steps.filter(step => step.completed).length;
    return Math.round((completed / objective.steps.length) * 100);
  }, [objective.steps]);

  return (
    <div className={`
      p-4 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">{objective.objective}</h4>
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {completion}% Complete
        </span>
      </div>
      
      {objective.steps?.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Steps
          </h5>
          <ul className="space-y-2">
            {objective.steps.map(step => (
              <li
                key={step.id}
                className={`
                  flex items-center
                  ${step.completed ? 'line-through opacity-50' : ''}
                `}
              >
                <span className="text-sm">{step.step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

Objective.propTypes = {
  objective: PropTypes.shape({
    objective: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      step: PropTypes.string.isRequired,
      completed: PropTypes.bool.isRequired
    })).isRequired
  }).isRequired,
  darkMode: PropTypes.bool.isRequired
};

function ProjectObjectivesTab({ project, darkMode }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Objectives</h3>
        <button
          onClick={() => console.log('Add new objective')}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
        >
          New Objective
        </button>
      </div>
      {project.objectives?.length > 0 ? (
        <div className="space-y-4">
          {project.objectives.map(objective => (
            <Objective
              key={objective.id}
              objective={objective}
              darkMode={darkMode}
            />
          ))}
        </div>
      ) : (
        <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No objectives added yet
        </div>
      )}
    </div>
  );
}

ProjectObjectivesTab.propTypes = {
  project: PropTypes.shape({
    objectives: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      objective: PropTypes.string.isRequired,
      steps: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        step: PropTypes.string.isRequired,
        completed: PropTypes.bool.isRequired
      }))
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default React.memo(ProjectObjectivesTab);