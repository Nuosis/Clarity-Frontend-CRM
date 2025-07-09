import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { fetchProposalsForProject } from '../../api/proposals';
import { processProposalData, validateProposalData, createCompleteProposal } from '../../services/proposalService';
import ProposalCreationForm from './ProposalCreationForm';
import ConceptGallery from './ConceptGallery';

/**
 * Project Proposal Tab component - handles a single proposal per project
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Object} props.localProject - Local project state
 * @param {Function} props.setLocalProject - Local project state setter
 */
function ProjectProposalsTab({ project, darkMode, localProject, setLocalProject }) {
  const [proposal, setProposal] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    concepts: [],
    deliverables: []
  });

  // Load existing proposal for the project
  useEffect(() => {
    const loadProposal = async () => {
      if (!project?.id) return;
      
      setLoading(true);
      try {
        const result = await fetchProposalsForProject(project.id);
        if (result.success && result.data.length > 0) {
          // Take the first (most recent) proposal
          const proposalData = processProposalData(result.data[0]);
          setProposal(proposalData);
          setFormData({
            title: proposalData.title || '',
            description: proposalData.description || '',
            concepts: proposalData.concepts || [],
            deliverables: proposalData.deliverables || []
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [project?.id]);

  const totalPrice = useMemo(() => {
    return formData.deliverables.reduce((sum, d) => sum + (d.price || 0), 0);
  }, [formData.deliverables]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
    // Reset form data to original proposal data
    if (proposal) {
      setFormData({
        title: proposal.title || '',
        description: proposal.description || '',
        concepts: proposal.concepts || [],
        deliverables: proposal.deliverables || []
      });
    }
  }, [proposal]);

  const handleCreate = useCallback(() => {
    setIsEditing(true);
    setError(null);
    setFormData({
      title: '',
      description: '',
      concepts: [],
      deliverables: []
    });
  }, []);

  const handleViewClientLink = useCallback(() => {
    if (!proposal?.access_token) {
      setError('No client access token available for this proposal');
      return;
    }
    
    // Generate the client view URL
    const clientUrl = `${window.location.origin}/proposal/view/${proposal.access_token}`;
    
    // Open in new window
    window.open(clientUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  }, [proposal]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate form data
      const validation = validateProposalData({
        ...formData,
        projectId: project.id,
        customerId: project._custID
      });

      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Create or update proposal
      const result = await createCompleteProposal(
        {
          ...formData,
          project_id: project.id,
          customer_id: project._custID
        },
        formData.deliverables
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setProposal(result.data);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [formData, project]);

  const handleAddDeliverable = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      deliverables: [
        ...prev.deliverables,
        {
          title: '',
          description: '',
          price: 0,
          type: 'fixed',
          isRequired: false,
          estimatedHours: 0
        }
      ]
    }));
  }, []);

  const handleDeliverableChange = useCallback((index, updatedDeliverable) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.map((d, i) => 
        i === index ? updatedDeliverable : d
      )
    }));
  }, []);

  const handleRemoveDeliverable = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }));
  }, []);

  const handleAddConcept = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      concepts: [
        ...prev.concepts,
        {
          title: '',
          description: '',
          type: 'wireframe',
          url: '',
          thumbnailUrl: ''
        }
      ]
    }));
  }, []);

  const handleConceptChange = useCallback((index, updatedConcept) => {
    setFormData(prev => ({
      ...prev,
      concepts: prev.concepts.map((c, i) =>
        i === index ? updatedConcept : c
      )
    }));
  }, []);

  const handleRemoveConcept = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      concepts: prev.concepts.filter((_, i) => i !== index)
    }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!proposal && !isEditing) {
    return (
      <div className="text-center py-8">
        <div className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="text-lg mb-2">No proposal exists for this project</p>
          <p className="text-sm">Create a proposal to present project details and deliverables to your client.</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
        >
          Create Proposal
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">
          {proposal ? 'Project Proposal' : 'Create Proposal'}
        </h3>
        {proposal && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Edit
            </button>
            <button
              onClick={handleViewClientLink}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              View Client Link
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Proposal Content */}
      {isEditing ? (
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Proposal Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={`
                  w-full px-3 py-2 border rounded-md
                  ${darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                  }
                `}
                placeholder="Enter proposal title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`
                  w-full px-3 py-2 border rounded-md
                  ${darkMode 
                    ? 'bg-gray-800 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                  }
                `}
                placeholder="Enter proposal description"
              />
            </div>
          </div>

          {/* Concepts & Assets Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium">Concepts & Assets</h4>
              <button
                onClick={handleAddConcept}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Add Concept
              </button>
            </div>
            
            {formData.concepts.length > 0 ? (
              <div className="space-y-4">
                {formData.concepts.map((concept, index) => (
                  <ConceptItem
                    key={index}
                    concept={concept}
                    index={index}
                    darkMode={darkMode}
                    onChange={handleConceptChange}
                    onRemove={handleRemoveConcept}
                  />
                ))}
              </div>
            ) : (
              <div className={`
                text-center py-6 border-2 border-dashed rounded-lg
                ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}
              `}>
                <p>No concepts added yet</p>
                <button
                  onClick={handleAddConcept}
                  className="mt-2 text-blue-500 hover:text-blue-600"
                >
                  Add your first concept
                </button>
              </div>
            )}
          </div>

          {/* Deliverables Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium">Deliverables</h4>
              <button
                onClick={handleAddDeliverable}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Add Deliverable
              </button>
            </div>
            
            {formData.deliverables.length > 0 ? (
              <div className="space-y-4">
                {formData.deliverables.map((deliverable, index) => (
                  <DeliverableItem
                    key={index}
                    deliverable={deliverable}
                    index={index}
                    darkMode={darkMode}
                    onChange={handleDeliverableChange}
                    onRemove={handleRemoveDeliverable}
                  />
                ))}
                
                <div className={`
                  p-3 rounded-lg border-2 border-dashed
                  ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}
                `}>
                  <div className="text-right">
                    <span className="text-lg font-semibold">
                      Total: ${totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`
                text-center py-6 border-2 border-dashed rounded-lg
                ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}
              `}>
                <p>No deliverables added yet</p>
                <button
                  onClick={handleAddDeliverable}
                  className="mt-2 text-primary hover:text-primary-hover"
                >
                  Add your first deliverable
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={handleCancel}
              disabled={saving}
              className={`
                px-4 py-2 border rounded-md
                ${darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }
                disabled:opacity-50
              `}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Proposal'}
            </button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="space-y-6">
          <div className={`
            p-4 rounded-lg border
            ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          `}>
            <h4 className="font-medium text-lg mb-2">{proposal.title}</h4>
            <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {proposal.description || 'No description provided'}
            </p>
            
            <div className="flex items-center justify-between">
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Created: {new Date(proposal.createdAt).toLocaleDateString()}
              </div>
              <div className="font-semibold">
                Total: ${(proposal.totalPrice || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Concepts Display */}
          {proposal.concepts && proposal.concepts.length > 0 && (
            <div>
              <h4 className="text-md font-medium mb-3">Concepts & Designs</h4>
              <ConceptGallery concepts={proposal.concepts} />
            </div>
          )}

          {/* Deliverables Display */}
          {proposal.deliverables && proposal.deliverables.length > 0 && (
            <div>
              <h4 className="text-md font-medium mb-3">Deliverables</h4>
              <div className="space-y-3">
                {proposal.deliverables.map((deliverable, index) => (
                  <div
                    key={deliverable.id || index}
                    className={`
                      p-3 rounded-lg border
                      ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-medium">{deliverable.title}</h5>
                        {deliverable.description && (
                          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {deliverable.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${deliverable.price?.toLocaleString()}</div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {deliverable.type === 'hourly' ? `${deliverable.estimatedHours}h` : 'Fixed'}
                          {deliverable.isRequired && ' • Required'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ConceptItem component for editing individual concepts
 * @param {Object} props - Component props
 * @param {Object} props.concept - Concept data
 * @param {number} props.index - Concept index
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onChange - Change handler
 * @param {Function} props.onRemove - Remove handler
 */
const ConceptItem = ({ concept, index, darkMode, onChange, onRemove }) => {
  const handleChange = useCallback((field, value) => {
    onChange(index, { ...concept, [field]: value });
  }, [concept, index, onChange]);

  return (
    <div className={`
      p-4 border rounded-lg
      ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
    `}>
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-medium">Concept {index + 1}</h5>
        <button
          onClick={() => onRemove(index)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded transition-colors"
          title="Remove concept"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={concept.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="Enter concept title"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={concept.type || 'wireframe'}
            onChange={(e) => handleChange('type', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            `}
          >
            <option value="wireframe">Wireframe</option>
            <option value="mockup">Mockup/Design</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            rows={2}
            value={concept.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="Enter concept description"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">URL</label>
          <input
            type="url"
            value={concept.url || ''}
            onChange={(e) => handleChange('url', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="Enter concept URL"
          />
        </div>
      </div>
    </div>
  );
};

ConceptItem.propTypes = {
  concept: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  darkMode: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired
};

/**
 * DeliverableItem component for editing individual deliverables
 * @param {Object} props - Component props
 * @param {Object} props.deliverable - Deliverable data
 * @param {number} props.index - Deliverable index
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onChange - Change handler
 * @param {Function} props.onRemove - Remove handler
 */
const DeliverableItem = ({ deliverable, index, darkMode, onChange, onRemove }) => {
  const handleChange = useCallback((field, value) => {
    onChange(index, { ...deliverable, [field]: value });
  }, [deliverable, index, onChange]);

  return (
    <div className={`
      p-4 border rounded-lg
      ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}
    `}>
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-medium">Deliverable {index + 1}</h5>
        <button
          onClick={() => onRemove(index)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded transition-colors"
          title="Remove deliverable"
        >
          ✕
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={deliverable.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="Enter deliverable title"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Price ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={deliverable.price || 0}
            onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="0.00"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={deliverable.type || 'fixed'}
            onChange={(e) => handleChange('type', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            `}
          >
            <option value="fixed">Fixed Price</option>
            <option value="hourly">Hourly Rate</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Estimated Hours</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={deliverable.estimatedHours || 0}
            onChange={(e) => handleChange('estimatedHours', parseFloat(e.target.value) || 0)}
            className={`
              w-full px-3 py-2 border rounded-md
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
              }
            `}
            placeholder="0"
          />
        </div>
      </div>
      
      <div className="mt-3">
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          rows={2}
          value={deliverable.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className={`
            w-full px-3 py-2 border rounded-md
            ${darkMode
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300'
            }
          `}
          placeholder="Enter deliverable description"
        />
      </div>
      
      <div className="mt-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={deliverable.isRequired || false}
            onChange={(e) => handleChange('isRequired', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">Required deliverable</span>
        </label>
      </div>
    </div>
  );
};

DeliverableItem.propTypes = {
  deliverable: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  darkMode: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired
};

ProjectProposalsTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    _custID: PropTypes.string.isRequired,
    title: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.object,
  setLocalProject: PropTypes.func.isRequired
};

export default ProjectProposalsTab;