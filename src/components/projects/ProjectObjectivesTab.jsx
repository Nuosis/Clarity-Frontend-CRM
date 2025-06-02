import React, { useMemo, useState } from 'react';
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

function ProjectObjectivesTab({ project, darkMode, onCreateObjective }) {
  const [showModal, setShowModal] = useState(false);
  const [objectiveText, setObjectiveText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!objectiveText.trim() || !onCreateObjective) return;

    try {
      setIsSubmitting(true);
      await onCreateObjective(project.id, objectiveText.trim());
      setObjectiveText('');
      setShowModal(false);
    } catch (error) {
      console.error('Error creating objective:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Objectives</h3>
        <button
          onClick={() => setShowModal(true)}
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

      {/* Add Objective Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            p-6 rounded-lg max-w-md w-full mx-4
            ${darkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <h3 className="text-lg font-semibold mb-4">Add New Objective</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Objective Description
                </label>
                <textarea
                  value={objectiveText}
                  onChange={(e) => setObjectiveText(e.target.value)}
                  placeholder="Enter objective description..."
                  rows={3}
                  className={`
                    w-full p-2 rounded-md border resize-none
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'}
                  `}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setObjectiveText('');
                  }}
                  disabled={isSubmitting}
                  className={`
                    px-4 py-2 rounded-md
                    ${darkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-200 hover:bg-gray-300'}
                    ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!objectiveText.trim() || isSubmitting}
                  className={`
                    px-4 py-2 bg-primary text-white rounded-md
                    ${objectiveText.trim() && !isSubmitting ? 'hover:bg-primary-hover' : 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

ProjectObjectivesTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    objectives: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      objective: PropTypes.string.isRequired,
      status: PropTypes.string,
      completed: PropTypes.bool.isRequired,
      steps: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        step: PropTypes.string.isRequired,
        completed: PropTypes.bool.isRequired
      }))
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onCreateObjective: PropTypes.func
};

export default React.memo(ProjectObjectivesTab);