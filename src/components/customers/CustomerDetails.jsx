import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppState, useAppStateOperations } from '../../context/AppStateContext';
import { useProject } from '../../hooks/useProject';
import { calculateRecordsUnbilledHours } from '../../services/projectService';
import { useSnackBar } from '../../context/SnackBarContext';
import { useSupabaseCustomer } from '../../hooks/useSupabaseCustomer';
import { useSales } from '../../hooks/useSales';

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
  onProjectCreate = () => {},
  isProspect = false
}) {
  const { darkMode } = useTheme();
  const { setLoading, setCustomerDetails } = useAppStateOperations();
  const { projectRecords } = useProject();
  const { showError } = useSnackBar();
  const { user, customerDetails } = useAppState();
  const { fetchOrCreateCustomerInSupabase } = useSupabaseCustomer();
  const { sales, loadSalesForCustomer, loadUnbilledSalesForCustomer } = useSales();
  
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showActivityReport, setShowActivityReport] = useState(false);
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [groupingError, setGroupingError] = useState(null);
  const [activeProspectTab, setActiveProspectTab] = useState('touch-history');

  // Function to load all sales for this customer
  const loadAllSalesForThisCustomer = useCallback(() => {
    const customerId = customerDetails?.id || customer?.id;
    if (customerId) {
      loadSalesForCustomer(customerId);
    }
  }, [customerDetails?.id, customer?.id, loadSalesForCustomer]);

  // Calculate stats for display
  const stats = useMemo(() => {
    if (!projects || !projectRecords) return null;
    
    const activeProjects = projects.filter(p => p.status === 'Open');
    
    // Calculate total sales for this customer
    let totalSales = 0;
    const customerId = customer?.id;
    const customerSPId = customerDetails?.id ;
    
    if (sales && sales.length > 0 && customerSPId ) {
      const customerSales = sales.filter(sale => sale.customer_id === customerSPId );
      console.log('Customer Sales:', customerSales);
      totalSales = customerSales.reduce((sum, sale) => {
        const amount = typeof sale.total_price === 'number' ? sale.total_price : parseFloat(sale.total_price || 0);
        return sum + amount;
      }, 0);
    }
    
    return {
      open: activeProjects.length,
      unbilledHours: calculateRecordsUnbilledHours(projectRecords, true, customerId),
      totalSales: totalSales
    };
  }, [projects, projectRecords, customerDetails?.id, customer?.id, sales]);

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

  // Memoize the fetch function to prevent infinite loops
  const handleFetchCustomerDetails = useCallback(async () => {
    if (customer && customer.Name && user && user.supabaseOrgID) {
      // Only fetch if we don't already have customer details for this customer
      if (!customerDetails || customerDetails.business_name !== customer.Name) {
        try {
          const customerData = await fetchOrCreateCustomerInSupabase(customer, user);
          if (customerData) {
            setCustomerDetails(customerData);
          }
        } catch (error) {
          console.error("[ERROR] Failed to fetch/create customer details in Supabase:", error);
          showError(`Error with customer details in Supabase: ${error.message}`);
        }
      }
    }
  }, [customer, user, customerDetails, fetchOrCreateCustomerInSupabase, setCustomerDetails, showError]);

  // Fetch or create customer details in Supabase when component mounts
  useEffect(() => {
    handleFetchCustomerDetails();
  }, [handleFetchCustomerDetails]);
  
  // Load sales data for this customer when customerDetails changes
  useEffect(() => {
    const customerId = customerDetails?.id || customer?.id;
    if (customerId) {
      loadUnbilledSalesForCustomer(customerId);
    }
  }, [customerDetails?.id, customer?.id, loadUnbilledSalesForCustomer]);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      {/* Customer Header */}
      <CustomerHeader
        customer={customer}
        stats={!isProspect ? stats : null}
        onNewProject={handleProjectCreate}
        onShowActivityReport={() => setShowActivityReport(true)}
        onEditProspect={() => setShowProspectForm(true)}
        isProspect={isProspect}
      />

      {/* Project Creation Form */}
      {showNewProjectInput && !isProspect && (
        <ProjectCreationForm
          customer={customer}
          onSubmit={handleProjectFormSubmit}
          onCancel={() => setShowNewProjectInput(false)}
        />
      )}

      {/* Prospect Form Modal */}
      {showProspectForm && isProspect && (
        <ProspectForm
          prospect={customer}
          onClose={() => setShowProspectForm(false)}
          darkMode={darkMode}
        />
      )}

      {/* Activity Report Modal */}
      {!isProspect && (
        <ActivityReportModal
          customer={customer}
          isOpen={showActivityReport}
          onClose={() => setShowActivityReport(false)}
        />
      )}

      {/* Error Display */}
      {groupingError && !isProspect && (
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

      {/* Projects Tabs - Hidden for Prospects */}
      {!isProspect && (
        <ProjectTabs
          activeProjects={activeProjects}
          closedProjects={closedProjects}
          onProjectSelect={onProjectSelect}
          setLoading={setLoading}
        />
      )}
      
      {/* Prospect Tabs */}
      {isProspect && (
        <div className={`
          border rounded-lg
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
        `}>
          {/* Tab Headers */}
          <div className={`
            flex border-b
            ${darkMode ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <button
              onClick={() => setActiveProspectTab('touch-history')}
              className={`
                px-6 py-3 font-medium transition-colors
                ${activeProspectTab === 'touch-history'
                  ? (darkMode
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'border-b-2 border-blue-600 text-blue-600')
                  : (darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
              `}
            >
              Touch History
            </button>
            <button
              onClick={() => setActiveProspectTab('email-campaign')}
              className={`
                px-6 py-3 font-medium transition-colors
                ${activeProspectTab === 'email-campaign'
                  ? (darkMode
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'border-b-2 border-blue-600 text-blue-600')
                  : (darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
              `}
            >
              Email Campaign
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeProspectTab === 'touch-history' && (
              <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>Touch History tracking coming soon...</p>
                <p className="text-sm mt-2">This will display email, SMS, meetings (Zoom, F2F, etc.) over time</p>
              </div>
            )}
            {activeProspectTab === 'email-campaign' && (
              <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>Email Campaign management coming soon...</p>
                <p className="text-sm mt-2">This will allow you to manage email campaigns for this prospect</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Customer Information Tabs - Hidden for Prospects */}
      {!isProspect && <CustomerTabs />}
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
  onProjectCreate: PropTypes.func,
  isProspect: PropTypes.bool
};

export default React.memo(CustomerDetails);