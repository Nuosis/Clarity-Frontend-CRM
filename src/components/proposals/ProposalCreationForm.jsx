import { useState, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { createProposal, selectProposalCreating, selectProposalError } from '../../store/slices/proposalSlice'

/**
 * Enhanced Proposal Creation Form Component
 * Admin interface for creating comprehensive proposals with rich features
 * Following PROPOSAL_DEVELOPMENT_GUIDE.md specifications
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {Function} props.onProposalCreate - Callback when proposal is created
 */
const ProposalCreationForm = ({ project, onProposalCreate }) => {
  const dispatch = useDispatch()
  const creating = useSelector(selectProposalCreating)
  const error = useSelector(selectProposalError)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requestSummary: {
      overview: '',
      objectives: [''],
      timeline: '',
      budget: 0
    }
  })
  
  const [deliverables, setDeliverables] = useState([
    {
      title: '',
      description: '',
      price: 0,
      type: 'fixed',
      estimatedHours: 0,
      isRequired: false,
      order: 0
    }
  ])
  
  const [concepts, setConcepts] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  
  // Calculate total price
  const totalPrice = useMemo(() => {
    return deliverables.reduce((sum, deliverable) => sum + (parseFloat(deliverable.price) || 0), 0)
  }, [deliverables])
  
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])
  
  const handleRequestSummaryChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      requestSummary: {
        ...prev.requestSummary,
        [field]: value
      }
    }))
  }, [])
  
  const handleObjectiveChange = useCallback((index, value) => {
    setFormData(prev => ({
      ...prev,
      requestSummary: {
        ...prev.requestSummary,
        objectives: prev.requestSummary.objectives.map((obj, i) => 
          i === index ? value : obj
        )
      }
    }))
  }, [])
  
  const addObjective = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      requestSummary: {
        ...prev.requestSummary,
        objectives: [...prev.requestSummary.objectives, '']
      }
    }))
  }, [])
  
  const removeObjective = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      requestSummary: {
        ...prev.requestSummary,
        objectives: prev.requestSummary.objectives.filter((_, i) => i !== index)
      }
    }))
  }, [])
  
  const handleDeliverableChange = useCallback((index, field, value) => {
    setDeliverables(prev => prev.map((deliverable, i) => 
      i === index ? { ...deliverable, [field]: value } : deliverable
    ))
  }, [])
  
  const addDeliverable = useCallback(() => {
    setDeliverables(prev => [...prev, {
      title: '',
      description: '',
      price: 0,
      type: 'fixed',
      estimatedHours: 0,
      isRequired: false,
      order: prev.length
    }])
  }, [])
  
  const removeDeliverable = useCallback((index) => {
    setDeliverables(prev => prev.filter((_, i) => i !== index))
  }, [])
  
  const handleConceptUpload = useCallback((event) => {
    const files = Array.from(event.target.files)
    
    files.forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newConcept = {
          id: crypto.randomUUID(),
          title: file.name,
          description: '',
          type: file.type.startsWith('image/') ? 'mockup' : 'document',
          url: e.target.result,
          thumbnailUrl: e.target.result,
          order: concepts.length + index
        }
        
        setConcepts(prev => [...prev, newConcept])
      }
      reader.readAsDataURL(file)
    })
  }, [concepts.length])
  
  const removeConcept = useCallback((conceptId) => {
    setConcepts(prev => prev.filter(concept => concept.id !== conceptId))
  }, [])
  
  const addConcept = useCallback(() => {
    const titleInput = document.getElementById('conceptTitle')
    const typeInput = document.getElementById('conceptType')
    const descriptionInput = document.getElementById('conceptDescription')
    const urlInput = document.getElementById('conceptUrl')
    
    const title = titleInput?.value?.trim()
    const type = typeInput?.value || 'wireframe'
    const description = descriptionInput?.value?.trim()
    const url = urlInput?.value?.trim()
    
    if (!title) {
      alert('Please enter a concept title')
      return
    }
    
    if (!url) {
      alert('Please either upload a file or enter a URL')
      return
    }
    
    const newConcept = {
      id: crypto.randomUUID(),
      title,
      description,
      type,
      url,
      thumbnailUrl: url, // For images, this will be the same as url
      order: concepts.length
    }
    
    setConcepts(prev => [...prev, newConcept])
    
    // Clear the form
    if (titleInput) titleInput.value = ''
    if (descriptionInput) descriptionInput.value = ''
    if (urlInput) urlInput.value = ''
    if (typeInput) typeInput.value = 'wireframe'
  }, [concepts.length])
  
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    const proposalData = {
      ...formData,
      projectId: project.id,
      customerId: project._custID,
      deliverables: deliverables.map((d, index) => ({ ...d, order: index })),
      concepts: concepts.map((c, index) => ({ ...c, order: index })),
      totalPrice,
      selectedPrice: totalPrice // Initially all deliverables are selected
    }
    
    try {
      const result = await dispatch(createProposal(proposalData))
      if (result.type === 'proposals/createProposal/fulfilled') {
        onProposalCreate?.(result.payload)
      }
    } catch (error) {
      console.error('Failed to create proposal:', error)
    }
  }, [dispatch, formData, deliverables, concepts, project, totalPrice, onProposalCreate])
  
  const togglePreview = useCallback(() => {
    setShowPreview(prev => !prev)
  }, [])
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <h3 className="text-xl font-semibold mb-6 text-gray-900">Create New Proposal</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          Error: {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-6">
          <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Proposal Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter a descriptive title for this proposal"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of the proposal"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>
          </div>
        </div>
        
        {/* Request Summary */}
        <div className="space-y-6">
          <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Request Summary</h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="overview" className="block text-sm font-medium text-gray-700 mb-2">
                Project Overview *
              </label>
              <textarea
                id="overview"
                value={formData.requestSummary.overview}
                onChange={(e) => handleRequestSummaryChange('overview', e.target.value)}
                placeholder="Provide a comprehensive overview of the project requirements and goals"
                rows={6}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Objectives</label>
              <div className="space-y-2">
                {formData.requestSummary.objectives.map((objective, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={objective}
                      onChange={(e) => handleObjectiveChange(index, e.target.value)}
                      placeholder={`Objective ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {formData.requestSummary.objectives.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeObjective(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={addObjective}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  Add Objective
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="timeline" className="block text-sm font-medium text-gray-700 mb-2">
                  Timeline
                </label>
                <input
                  type="text"
                  id="timeline"
                  value={formData.requestSummary.timeline}
                  onChange={(e) => handleRequestSummaryChange('timeline', e.target.value)}
                  placeholder="e.g., 4-6 weeks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Budget
                </label>
                <input
                  type="number"
                  id="budget"
                  value={formData.requestSummary.budget}
                  onChange={(e) => handleRequestSummaryChange('budget', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Concepts & Assets */}
        <div className="space-y-6">
          <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Concepts & Assets</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            Add visual concepts, wireframes, mockups, videos, and reference materials to help communicate your vision to the client.
          </p>
          
          {/* Add New Concept */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h5 className="text-base font-medium text-gray-900 mb-4">Add New Concept</h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="conceptTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Concept Title *
                </label>
                <input
                  type="text"
                  id="conceptTitle"
                  placeholder="e.g., Homepage Wireframe, Logo Concepts, User Flow"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="conceptType" className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select 
                  id="conceptType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="wireframe">Wireframe</option>
                  <option value="mockup">Mockup/Design</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="conceptDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Description/Writeup
              </label>
              <textarea
                id="conceptDescription"
                placeholder="Describe this concept, its purpose, key features, or any important details the client should know..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>
            
            <div className="mb-4">
              <h6 className="text-sm font-medium text-gray-700 mb-3">Add Asset:</h6>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
                    onChange={handleConceptUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Images, videos, PDFs, documents
                  </p>
                </div>
                
                {/* URL Input Option */}
                <div>
                  <label htmlFor="conceptUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    Or Enter URL
                  </label>
                  <input
                    type="url"
                    id="conceptUrl"
                    placeholder="https://figma.com/... or any external link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Figma, InVision, YouTube, etc.
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={addConcept}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Add Concept
            </button>
          </div>
          
          {/* Existing Concepts List */}
          {concepts.length > 0 && (
            <div>
              <h5 className="text-base font-medium text-gray-900 mb-4">
                Added Concepts ({concepts.length})
              </h5>
              
              <div className="space-y-3">
                {concepts.map((concept, index) => (
                  <div key={concept.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h6 className="font-medium text-gray-900 mb-1">
                          {concept.title}
                        </h6>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {concept.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            Order: {index + 1}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeConcept(concept.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    {concept.description && (
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded mb-3">
                        {concept.description}
                      </p>
                    )}
                    
                    {concept.url && (
                      <div className="flex items-center gap-3">
                        {concept.type === 'wireframe' || concept.type === 'mockup' ? (
                          <div 
                            className="w-15 h-10 bg-gray-200 rounded border border-gray-300 bg-cover bg-center"
                            style={{ backgroundImage: `url(${concept.url})` }}
                          />
                        ) : (
                          <div className="w-15 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-lg">
                            {concept.type === 'video' ? '🎥' : '📄'}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <a
                            href={concept.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Asset →
                          </a>
                          <div className="text-xs text-gray-500 truncate">
                            {concept.url.length > 50 ? concept.url.substring(0, 50) + '...' : concept.url}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Deliverables */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Deliverables</h4>
            <button
              type="button"
              onClick={addDeliverable}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            >
              Add Deliverable
            </button>
          </div>
          
          <div className="space-y-4">
            {deliverables.map((deliverable, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h5 className="font-medium text-gray-900">Deliverable {index + 1}</h5>
                  <button
                    type="button"
                    onClick={() => removeDeliverable(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={deliverable.title || ''}
                      onChange={(e) => handleDeliverableChange(index, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Deliverable title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                    <input
                      type="number"
                      value={deliverable.price || ''}
                      onChange={(e) => handleDeliverableChange(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={deliverable.description || ''}
                    onChange={(e) => handleDeliverableChange(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                    placeholder="Describe this deliverable"
                  />
                </div>
                
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={deliverable.isRequired || false}
                      onChange={(e) => handleDeliverableChange(index, 'isRequired', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Type:</label>
                    <select
                      value={deliverable.type || 'fixed'}
                      onChange={(e) => handleDeliverableChange(index, 'type', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="fixed">Fixed Price</option>
                      <option value="hourly">Hourly Rate</option>
                    </select>
                  </div>
                  
                  {deliverable.type === 'hourly' && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm">Est. Hours:</label>
                      <input
                        type="number"
                        value={deliverable.estimatedHours || ''}
                        onChange={(e) => handleDeliverableChange(index, 'estimatedHours', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <span className="text-lg font-semibold text-gray-900">
                Total: ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Preview Section */}
        {showPreview && (
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Proposal Preview</h4>
            <p className="text-sm text-gray-600">Preview functionality coming soon...</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={togglePreview}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Proposal'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

ProposalCreationForm.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    _custID: PropTypes.string.isRequired
  }).isRequired,
  onProposalCreate: PropTypes.func
}

export default ProposalCreationForm