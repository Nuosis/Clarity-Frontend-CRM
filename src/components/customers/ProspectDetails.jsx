import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useSnackBar } from '../../context/SnackBarContext';
import CustomerHeader from './CustomerHeader';
import ProspectForm from './ProspectForm';
import ConvertProspectModal from './ConvertProspectModal';
import EmailCampaignEditor from './EmailCampaignEditor';
import ProjectListing from './ProjectListing';
import ProjectCreationForm from './ProjectCreationForm';

/**
 * ProspectDetails component - displays prospect information and tabs
 * @param {Object} props - Component props
 * @param {Object} props.prospect - The prospect object
 * @param {Array} props.projects - List of projects for this prospect
 * @param {Function} props.onProjectSelect - Handler for project selection
 * @param {Function} props.onProjectCreate - Handler for project creation
 */
function ProspectDetails({ prospect, projects = [], onProjectSelect, onProjectCreate }) {
  const { darkMode } = useTheme();
  const { showSuccess } = useSnackBar();
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [activeTab, setActiveTab] = useState('touch-history');
  
  const { setLoading } = useAppStateOperations();

  // Memoized project grouping
  const { activeProjects, closedProjects } = useMemo(() => {
    if (!projects || projects.length === 0) {
      return { activeProjects: [], closedProjects: [] };
    }
    
    return projects.reduce((acc, project) => {
      if (project.status === 'Open') {
        acc.activeProjects.push(project);
      } else {
        acc.closedProjects.push(project);
      }
      return acc;
    }, { activeProjects: [], closedProjects: [] });
  }, [projects]);

  const handleEditProspect = useCallback(() => {
    setShowProspectForm(true);
  }, []);

  const handleConvertToCustomer = useCallback(() => {
    setShowConvertModal(true);
  }, []);

  const handleConversionSuccess = useCallback((result) => {
    showSuccess(`Successfully converted ${prospect.Name} to customer`);
    // The prospect will be removed from the list by the hook
    // User will need to navigate away or the parent component will handle this
  }, [prospect.Name, showSuccess]);

  const handleNewProject = useCallback(() => {
    setShowNewProjectInput(true);
  }, []);

  const handleProjectFormSubmit = useCallback(async (projectData) => {
    if (onProjectCreate) {
      await onProjectCreate(projectData);
    }
    setShowNewProjectInput(false);
  }, [onProjectCreate]);

  const handleProjectSelection = useCallback((project) => {
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  }, [onProjectSelect]);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      {/* Prospect Header */}
      <CustomerHeader
        customer={prospect}
        stats={null}
        onEditProspect={handleEditProspect}
        onConvertToCustomer={handleConvertToCustomer}
        isProspect={true}
      />

      {/* Prospect Form Modal */}
      {showProspectForm && (
        <ProspectForm
          prospect={prospect}
          onClose={() => setShowProspectForm(false)}
          darkMode={darkMode}
        />
      )}

      {/* Convert to Customer Modal */}
      {showConvertModal && (
        <ConvertProspectModal
          prospect={prospect}
          onClose={() => setShowConvertModal(false)}
          onSuccess={handleConversionSuccess}
          darkMode={darkMode}
        />
      )}

      {/* Project Creation Form */}
      {showNewProjectInput && (
        <ProjectCreationForm
          customer={prospect}
          onSubmit={handleProjectFormSubmit}
          onCancel={() => setShowNewProjectInput(false)}
        />
      )}

      {/* Prospect Tabs */}
      <div>
        {/* Tab Headers */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('touch-history')}
            className={`px-4 py-2 font-medium focus:outline-none relative transition-colors ${
              activeTab === 'touch-history'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            style={{
              border: 'none',
              borderRadius: '0',
              borderBottom: activeTab === 'touch-history'
                ? '2px solid #004967'
                : '2px solid transparent',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'touch-history') {
                e.currentTarget.style.borderBottom = darkMode ? '2px solid #6b7280' : '2px solid #d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'touch-history') {
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            Touch History
          </button>
          <button
            onClick={() => setActiveTab('email-campaign')}
            className={`px-4 py-2 font-medium focus:outline-none relative transition-colors ${
              activeTab === 'email-campaign'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            style={{
              border: 'none',
              borderRadius: '0',
              borderBottom: activeTab === 'email-campaign'
                ? '2px solid #004967'
                : '2px solid transparent',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'email-campaign') {
                e.currentTarget.style.borderBottom = darkMode ? '2px solid #6b7280' : '2px solid #d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'email-campaign') {
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            Email Campaign
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 font-medium focus:outline-none relative transition-colors ${
              activeTab === 'projects'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            style={{
              border: 'none',
              borderRadius: '0',
              borderBottom: activeTab === 'projects'
                ? '2px solid #004967'
                : '2px solid transparent',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'projects') {
                e.currentTarget.style.borderBottom = darkMode ? '2px solid #6b7280' : '2px solid #d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'projects') {
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            Projects
          </button>
        </div>

        {/* Tab Content */}
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
          {activeTab === 'touch-history' && (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Touch History tracking coming soon...</p>
              <p className="text-sm mt-2">This will display email, SMS, meetings (Zoom, F2F, etc.) over time</p>
            </div>
          )}
          {activeTab === 'email-campaign' && (
            <EmailCampaignEditor
              prospectId={prospect.id}
              prospect={prospect}
              darkMode={darkMode}
            />
          )}
          {activeTab === 'projects' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium">Projects</h4>
                <button
                  onClick={handleNewProject}
                  className={`
                    px-4 py-2 rounded-md transition-colors
                    ${darkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'}
                  `}
                >
                  New Project
                </button>
              </div>
              
              {activeProjects.length === 0 && closedProjects.length === 0 ? (
                <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>No projects yet</p>
                  <p className="text-sm mt-2">Create a project to get started</p>
                </div>
              ) : (
                <>
                  <ProjectListing
                    title="Active Projects"
                    projects={activeProjects}
                    onProjectSelect={handleProjectSelection}
                    setLoading={setLoading}
                  />
                  
                  {closedProjects.length > 0 && (
                    <ProjectListing
                      title="Closed Projects"
                      projects={closedProjects}
                      onProjectSelect={handleProjectSelection}
                      setLoading={setLoading}
                      collapsible={true}
                      initiallyCollapsed={true}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ProspectDetails.propTypes = {
  prospect: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string
  }).isRequired,
  projects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      projectName: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      estOfTime: PropTypes.string,
      objectives: PropTypes.array.isRequired,
      tasks: PropTypes.array
    })
  ),
  onProjectSelect: PropTypes.func,
  onProjectCreate: PropTypes.func
};

export default React.memo(ProspectDetails);