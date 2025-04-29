import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';
import { useProject } from '../../hooks/useProject';
import { calculateRecordsUnbilledHours } from '../../services/projectService';
import { useSnackBar } from '../../context/SnackBarContext';
import { useSupabaseCustomer } from '../../hooks/useSupabaseCustomer';

// Import our new components
import CustomerHeader from './CustomerHeader';
import ProjectCreationForm from './ProjectCreationForm';
import CustomerTabs from './CustomerTabs';
import ActivityReportModal from './ActivityReportModal';
import ProjectTabs from './ProjectTabs';

function CustomerDetails({
  customer,
  projects = [],
  onProjectSelect = () => {},
  onProjectCreate = () => {}
}) {
  const { darkMode } = useTheme();
  const { setLoading, setCustomerDetails } = useAppStateOperations();
  const { projectRecords } = useProject();
  const { showError } = useSnackBar();
  const { user } = useAppState();
  const { fetchOrCreateCustomerInSupabase } = useSupabaseCustomer();
  
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showActivityReport, setShowActivityReport] = useState(false);
  const [groupingError, setGroupingError] = useState(null);

  // Calculate stats for display
  const stats = useMemo(() => {
    if (!projects || !projectRecords) return null;
    
    const activeProjects = projects.filter(p => p.status === 'Open');
    return {
      open: activeProjects.length,
      unbilledHours: calculateRecordsUnbilledHours(projectRecords, true, customer.id),
      totalSales: 0 // Placeholder for total sales
    };
  }, [projects, projectRecords, customer.id]);

  // Memoized project grouping with error handling
  const { activeProjects, closedProjects } = useMemo(() => {
    try {
      const result = projects.reduce((acc, project) => {
        if (!project || !project.status) {
          throw new Error('Invalid project data');
        }
        
        if (project.status === 'Open') {
          acc.activeProjects.push(project);
        } else {
          acc.closedProjects.push(project);
        }
        return acc;
      }, { activeProjects: [], closedProjects: [] });
      
      setGroupingError(null);
      return result;
    } catch (error) {
      console.error('Error grouping projects:', error);
      setGroupingError(error.message);
      return {
        activeProjects: [],
        closedProjects: []
      };
    }
  }, [projects]);

  // Memoized handlers
  const handleProjectCreate = useCallback(() => {
    setShowNewProjectInput(true);
  }, []);
  
  // Handle project form submission
  const handleProjectFormSubmit = useCallback((projectData) => {
    onProjectCreate(projectData);
    setShowNewProjectInput(false);
  }, [onProjectCreate]);

  // Fetch or create customer details in Supabase when component mounts
  useEffect(() => {
    if (customer && customer.Name && user && user.supabaseOrgID) {
      fetchOrCreateCustomerInSupabase(customer, user)
        .then(customerData => {
          if (customerData) {
            setCustomerDetails(customerData);
          }
        })
        .catch(error => {
          console.error("[ERROR] Failed to fetch/create customer details in Supabase:", error);
          showError(`Error with customer details in Supabase: ${error.message}`);
        });
    }
  }, [customer, user, fetchOrCreateCustomerInSupabase, setCustomerDetails, showError]);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      {/* Customer Header */}
      <CustomerHeader 
        customer={customer}
        stats={stats}
        onNewProject={handleProjectCreate}
        onShowActivityReport={() => setShowActivityReport(true)}
      />

      {/* Project Creation Form */}
      {showNewProjectInput && (
        <ProjectCreationForm
          customer={customer}
          onSubmit={handleProjectFormSubmit}
          onCancel={() => setShowNewProjectInput(false)}
        />
      )}

      {/* Activity Report Modal */}
      <ActivityReportModal
        customer={customer}
        isOpen={showActivityReport}
        onClose={() => setShowActivityReport(false)}
      />

      {/* Error Display */}
      {groupingError && (
        <div className={`
          p-4 mb-6 rounded-lg border
          ${darkMode
            ? 'bg-red-900/20 border-red-800 text-red-200'
            : 'bg-red-50 border-red-200 text-red-800'}
        `}>
          <div className="font-medium">Error loading projects:</div>
          <div className="text-sm mt-1">{groupingError}</div>
        </div>
      )}

      {/* Projects Tabs */}
      <ProjectTabs
        activeProjects={activeProjects}
        closedProjects={closedProjects}
        onProjectSelect={onProjectSelect}
        setLoading={setLoading}
      />
      
      {/* Customer Information Tabs */}
      <CustomerTabs customer={customer} />
    </div>
  );
}

CustomerDetails.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string
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

export default React.memo(CustomerDetails);