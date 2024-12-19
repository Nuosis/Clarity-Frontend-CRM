import React from 'react';
import { useSelector } from 'react-redux';

const ProjectSelect = ({ selectedProject, onChange }) => {
  const projectData = useSelector(state => state.project.projectData);

  // Group projects by customer with safety checks
  const groupedProjects = projectData?.reduce((acc, project) => {
    if (!project?.fieldData) return acc;
    
    const customerName = project.fieldData['Customers::Name'] || 'Unassigned';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(project);
    return acc;
  }, {}) || {};

  // Sort customers alphabetically
  const sortedCustomers = Object.keys(groupedProjects).sort();

  return (
    <select
      value={selectedProject}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 appearance-none bg-white"
    >
      <option value="">Select Project</option>
      {sortedCustomers.map(customerName => (
        <optgroup key={customerName} label={customerName}>
          {groupedProjects[customerName]
            .filter(project => project?.fieldData?.projectName) // Add safety check
            .sort((a, b) => 
              (a.fieldData.projectName || '').localeCompare(b.fieldData.projectName || '')
            )
            .map(project => (
              <option 
                key={project.fieldData["__ID"]} 
                value={project.fieldData["__ID"]}
              >
                {project.fieldData.projectName}
              </option>
            ))
          }
        </optgroup>
      ))}
    </select>
  );
};

export default ProjectSelect;
