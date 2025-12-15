import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import RequirementCard from './RequirementCard';

function ProductRequirementsBuilder({ requirements, onChange, darkMode }) {
  const [expandedCards, setExpandedCards] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);

  const toggleCard = useCallback((index) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }, []);

  const handleAddRequirement = () => {
    const newRequirement = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      type: 'list',
      required: false,
      fields: []
    };
    onChange([...requirements, newRequirement]);
    // Expand the new requirement
    setExpandedCards(prev => ({
      ...prev,
      [requirements.length]: true
    }));
  };

  const handleRemoveRequirement = (index) => {
    const newRequirements = requirements.filter((_, i) => i !== index);
    onChange(newRequirements);
    // Clean up expanded state
    const newExpandedCards = { ...expandedCards };
    delete newExpandedCards[index];
    setExpandedCards(newExpandedCards);
  };

  const handleRequirementChange = (index, field, value) => {
    const newRequirements = [...requirements];
    newRequirements[index] = {
      ...newRequirements[index],
      [field]: value
    };
    onChange(newRequirements);
  };

  const handleFieldsChange = (index, newFields) => {
    const newRequirements = [...requirements];
    newRequirements[index] = {
      ...newRequirements[index],
      fields: newFields
    };
    onChange(newRequirements);
  };

  // Drag and Drop handlers
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRequirements = [...requirements];
    const draggedItem = newRequirements[draggedIndex];

    // Remove from old position
    newRequirements.splice(draggedIndex, 1);
    // Insert at new position
    newRequirements.splice(index, 0, draggedItem);

    onChange(newRequirements);
    setDraggedIndex(index);
  }, [draggedIndex, requirements, onChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Customer Requirements
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Define what customers need to configure when purchasing this product
          </p>
        </div>
      </div>

      {requirements.length === 0 ? (
        <div className={`
          p-8 rounded-lg border-2 border-dashed text-center
          ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}
        `}>
          <svg
            className={`mx-auto h-16 w-16 mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <h4 className={`text-lg font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            No requirements configured
          </h4>
          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            This product doesn't require any customer configuration yet
          </p>
          <button
            type="button"
            onClick={handleAddRequirement}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
          >
            Add First Requirement
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requirements.map((requirement, index) => (
              <div
                key={requirement.id || index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  transition-opacity duration-200
                  ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}
                `}
              >
                <RequirementCard
                  requirement={requirement}
                  index={index}
                  isExpanded={expandedCards[index] || false}
                  onToggle={() => toggleCard(index)}
                  onChange={(field, value) => handleRequirementChange(index, field, value)}
                  onRemove={() => handleRemoveRequirement(index)}
                  onFieldsChange={(newFields) => handleFieldsChange(index, newFields)}
                  darkMode={darkMode}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddRequirement}
            className={`
              w-full px-4 py-3 border-2 border-dashed rounded-lg text-sm font-medium
              transition-colors duration-200
              ${darkMode
                ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 hover:bg-gray-800'
                : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'}
            `}
          >
            + Add Another Requirement
          </button>
        </>
      )}

      {requirements.length > 0 && (
        <div className={`
          mt-4 p-3 rounded-md text-sm
          ${darkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-800'}
        `}>
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Tip: You can drag requirements to reorder them</p>
              <p className="text-xs mt-1 opacity-90">
                The order you define here is the order customers will see when configuring the product.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ProductRequirementsBuilder.propTypes = {
  requirements: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
    fields: PropTypes.array
  })).isRequired,
  onChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default ProductRequirementsBuilder;
