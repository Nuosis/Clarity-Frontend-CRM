import React from 'react';
import PropTypes from 'prop-types';
import TextInput from '../global/TextInput';

function ProjectCreationForm({ 
  customer, 
  onSubmit, 
  onCancel 
}) {
  const handleSubmit = (projectName) => {
    const projectData = {
      customerId: customer.id,
      customerName: customer.Name,
      name: projectName,
      projectName: projectName,
      _custID: customer.id
    };
    
    onSubmit(projectData);
  };
  
  return (
    <div className="mb-6">
      <TextInput
        title="Create New Project"
        placeholder="Enter project name..."
        submitLabel="Create"
        onSubmit={handleSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}

ProjectCreationForm.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default ProjectCreationForm;