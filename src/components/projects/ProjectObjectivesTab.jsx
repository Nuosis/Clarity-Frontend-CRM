import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

// Memoized objective component
const Objective = React.memo(function Objective({
  objective,
  darkMode,
  onEdit,
  onDelete,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onToggleStep
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(objective.objective);
  const [newStepText, setNewStepText] = useState('');
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingStepText, setEditingStepText] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);

  const completion = useMemo(() => {
    if (!objective.steps?.length) return 0;
    const completed = objective.steps.filter(step => step.completed).length;
    return Math.round((completed / objective.steps.length) * 100);
  }, [objective.steps]);

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== objective.objective) {
      onEdit(objective.id, { objective: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleAddStep = async () => {
    if (newStepText.trim()) {
      await onAddStep(objective.id, newStepText.trim());
      setNewStepText('');
      setShowAddStep(false);
    }
  };

  const handleEditStep = (stepId) => {
    if (editingStepText.trim()) {
      onEditStep(stepId, { step: editingStepText.trim() });
      setEditingStepId(null);
      setEditingStepText('');
    }
  };

  const startEditingStep = (step) => {
    setEditingStepId(step.id);
    setEditingStepText(step.step);
  };

  return (
    <div className={`
      p-4 rounded-lg border
      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
    `}>
      <div className="flex items-center justify-between mb-2">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className={`flex-1 px-2 py-1 rounded border ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              className="px-2 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className={`px-2 py-1 text-sm rounded ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h4 className="font-medium flex-1">{objective.objective}</h4>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {completion}% Complete
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className={`p-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700`}
                title="Edit objective"
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(objective.id)}
                className={`p-1 text-sm rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600`}
                title="Delete objective"
              >
                🗑️
              </button>
            </div>
          </>
        )}
      </div>

      {/* Steps Section */}
      <div className="mt-3">
        {objective.steps?.length > 0 && (
          <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 mb-2">
            <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Steps
            </h5>
            <ul className="space-y-2">
              {objective.steps.map(step => (
                <li key={step.id} className="flex items-center gap-2 group">
                  {editingStepId === step.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingStepText}
                        onChange={(e) => setEditingStepText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditStep(step.id);
                          if (e.key === 'Escape') {
                            setEditingStepId(null);
                            setEditingStepText('');
                          }
                        }}
                        className={`flex-1 px-2 py-1 text-sm rounded border ${
                          darkMode
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditStep(step.id)}
                        className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingStepId(null);
                          setEditingStepText('');
                        }}
                        className={`px-2 py-1 text-xs rounded ${
                          darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => onToggleStep(step.id)}
                        className="rounded"
                      />
                      <span className={`text-sm flex-1 ${step.completed ? 'line-through opacity-50' : ''}`}>
                        {step.step}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          onClick={() => startEditingStep(step)}
                          className="p-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit step"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeleteStep(step.id)}
                          className="p-1 text-xs rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
                          title="Delete step"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add Step Section */}
        {showAddStep ? (
          <div className="pl-4 flex items-center gap-2">
            <input
              type="text"
              value={newStepText}
              onChange={(e) => setNewStepText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStep();
                if (e.key === 'Escape') {
                  setShowAddStep(false);
                  setNewStepText('');
                }
              }}
              placeholder="Enter step description..."
              className={`flex-1 px-2 py-1 text-sm rounded border ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              autoFocus
            />
            <button
              onClick={handleAddStep}
              className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddStep(false);
                setNewStepText('');
              }}
              className={`px-2 py-1 text-xs rounded ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddStep(true)}
            className={`pl-4 text-sm ${
              darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            + Add Step
          </button>
        )}
      </div>
    </div>
  );
});

Objective.propTypes = {
  objective: PropTypes.shape({
    id: PropTypes.string.isRequired,
    objective: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      step: PropTypes.string.isRequired,
      completed: PropTypes.bool.isRequired
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onAddStep: PropTypes.func.isRequired,
  onEditStep: PropTypes.func.isRequired,
  onDeleteStep: PropTypes.func.isRequired,
  onToggleStep: PropTypes.func.isRequired
};

function ProjectObjectivesTab({
  project,
  darkMode,
  onCreateObjective,
  onUpdateObjective,
  onDeleteObjective,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  onToggleStep
}) {
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

  const handleEditObjective = async (objectiveId, data) => {
    try {
      await onUpdateObjective(objectiveId, data);
    } catch (error) {
      console.error('Error updating objective:', error);
    }
  };

  const handleDeleteObjective = async (objectiveId) => {
    if (!window.confirm('Are you sure you want to delete this objective? All steps will also be deleted.')) {
      return;
    }
    try {
      await onDeleteObjective(objectiveId);
    } catch (error) {
      console.error('Error deleting objective:', error);
    }
  };

  const handleAddStep = async (objectiveId, stepText) => {
    try {
      await onCreateStep(objectiveId, stepText);
    } catch (error) {
      console.error('Error creating step:', error);
    }
  };

  const handleEditStep = async (stepId, data) => {
    try {
      await onUpdateStep(stepId, data);
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!window.confirm('Are you sure you want to delete this step?')) {
      return;
    }
    try {
      await onDeleteStep(stepId);
    } catch (error) {
      console.error('Error deleting step:', error);
    }
  };

  const handleToggleStep = async (stepId) => {
    try {
      await onToggleStep(stepId);
    } catch (error) {
      console.error('Error toggling step:', error);
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
              onEdit={handleEditObjective}
              onDelete={handleDeleteObjective}
              onAddStep={handleAddStep}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
              onToggleStep={handleToggleStep}
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
      completed: PropTypes.bool,
      steps: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        step: PropTypes.string.isRequired,
        completed: PropTypes.bool.isRequired
      }))
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onCreateObjective: PropTypes.func.isRequired,
  onUpdateObjective: PropTypes.func.isRequired,
  onDeleteObjective: PropTypes.func.isRequired,
  onCreateStep: PropTypes.func.isRequired,
  onUpdateStep: PropTypes.func.isRequired,
  onDeleteStep: PropTypes.func.isRequired,
  onToggleStep: PropTypes.func.isRequired
};

export default React.memo(ProjectObjectivesTab);