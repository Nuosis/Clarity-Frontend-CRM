import React from 'react';
import { useTheme } from '../layout/AppLayout';

export default function CustomerDetails({ 
  customer,
  projects = [],
  onProjectSelect = () => {}
}) {
  const { darkMode } = useTheme();

  // Filter projects for this customer
  const customerProjects = projects.filter(
    project => project._custID === customer.fieldData.__ID
  );

  // Group projects by status
  const openProjects = customerProjects.filter(
    project => project.status === "Open"
  );
  const closedProjects = customerProjects.filter(
    project => project.status === "Closed"
  );

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold">
          {customer.fieldData.Name}
        </h2>
        {customer.fieldData.OBSI_ClientNo && (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Client #{customer.fieldData.OBSI_ClientNo}
          </p>
        )}
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <h3 className="font-medium mb-2">Contact Information</h3>
          <div className="space-y-2">
            {customer.fieldData.Email && (
              <p>
                <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email: </span>
                {customer.fieldData.Email}
              </p>
            )}
            {customer.fieldData.phone && (
              <p>
                <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone: </span>
                {customer.fieldData.phone}
              </p>
            )}
          </div>
        </div>
        <div className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <h3 className="font-medium mb-2">Account Details</h3>
          <div className="space-y-2">
            <p>
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rate: </span>
              ${customer.fieldData.chargeRate}/hr
            </p>
            <p>
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status: </span>
              {customer.fieldData.f_active === 1 ? (
                <span className="text-green-600 dark:text-green-400">Active</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Inactive</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Projects</h3>
        
        {/* Open Projects */}
        {openProjects.length > 0 && (
          <div className="mb-6">
            <h4 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Open Projects
            </h4>
            <div className="space-y-2">
              {openProjects.map(project => (
                <button
                  key={project.__ID}
                  onClick={() => onProjectSelect(project)}
                  className={`
                    w-full text-left p-3 rounded-lg
                    transition-colors duration-150
                    ${darkMode 
                      ? 'hover:bg-gray-700 bg-gray-800' 
                      : 'hover:bg-gray-100 bg-white'
                    }
                    border ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                  `}
                >
                  <div className="font-medium">{project.projectName}</div>
                  {project.estOfTime && (
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Est. Time: {project.estOfTime}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Closed Projects */}
        {closedProjects.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Closed Projects
            </h4>
            <div className="space-y-2">
              {closedProjects.map(project => (
                <button
                  key={project.__ID}
                  onClick={() => onProjectSelect(project)}
                  className={`
                    w-full text-left p-3 rounded-lg
                    transition-colors duration-150
                    ${darkMode 
                      ? 'hover:bg-gray-700 bg-gray-800/50' 
                      : 'hover:bg-gray-100 bg-gray-50'
                    }
                    border ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                  `}
                >
                  <div className="font-medium">{project.projectName}</div>
                  {project.estOfTime && (
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Est. Time: {project.estOfTime}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Projects Message */}
        {customerProjects.length === 0 && (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No projects found for this customer
          </div>
        )}
      </div>
    </div>
  );
}