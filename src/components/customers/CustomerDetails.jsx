import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppStateOperations } from '../../context/AppStateContext';
import { useProject } from '../../hooks/useProject';
import { calculateRecordsUnbilledHours } from '../../services/projectService';
import { initializeQuickBooks } from '../../api/fileMaker';
import { useSnackBar } from '../../context/SnackBarContext';
import {
    fetchCustomerActivityData,
    processActivityData,
    formatActivityRecordForDisplay
} from '../../api/customerActivity';
import TextInput from '../global/TextInput';

// Memoized project card component
const ProjectCard = React.memo(function ProjectCard({
    project,
    darkMode,
    onSelect,
    setLoading
}) {
    const completion = useMemo(() => {
        const totalSteps = project.objectives.reduce(
            (total, obj) => total + obj.steps.length,
            0
        );
        
        if (totalSteps === 0) return 0;

        const completedSteps = project.objectives.reduce(
            (total, obj) => total + obj.steps.filter(step => step.completed).length,
            0
        );

        return Math.round((completedSteps / totalSteps) * 100);
    }, [project.objectives]);

    return (
        <div
            onClick={(e) => {
                setLoading(true);
                onSelect(project);
            }}
            className={`
                p-4 rounded-lg border cursor-pointer
                ${darkMode 
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                transition-colors duration-150
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{project.projectName}</h3>
                <span className={`
                    px-2 py-1 text-sm rounded-full
                    ${project.status === 'Open'
                        ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                        : (darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800')}
                `}>
                    {project.status}
                </span>
            </div>
            
            <div className="space-y-2">
                {project.estOfTime && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Estimated Time: {project.estOfTime}
                    </p>
                )}
                
                <div className="flex items-center space-x-4">
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Completion: {completion}%
                    </div>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-bg-[#004967] rounded-full"
                            style={{ width: `${completion}%` }}
                        />
                    </div>
                </div>

                <div className="flex space-x-4 text-sm">
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {project.objectives.length} Objectives
                    </span>
                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {project.tasks?.length || 0} Tasks
                    </span>
                </div>
            </div>
        </div>
    );
});

ProjectCard.propTypes = {
    project: PropTypes.shape({
        projectName: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        estOfTime: PropTypes.string,
        objectives: PropTypes.arrayOf(PropTypes.shape({
            steps: PropTypes.arrayOf(PropTypes.shape({
                completed: PropTypes.bool.isRequired
            })).isRequired
        })).isRequired,
        tasks: PropTypes.array
    }).isRequired,
    darkMode: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    setLoading: PropTypes.func.isRequired
};

function CustomerDetails({
    customer,
    projects = [],
    onProjectSelect = () => {},
    onProjectCreate = () => {}
}) {
    const { darkMode } = useTheme();
    const { setLoading } = useAppStateOperations();
    const { projectRecords } = useProject();
    const { showError } = useSnackBar();
    const [isProcessingQB, setIsProcessingQB] = useState(false);
    const [showNewProjectInput, setShowNewProjectInput] = useState(false);
    const [showActivityReport, setShowActivityReport] = useState(false);
    const [activityTimeframe, setActivityTimeframe] = useState('unbilled'); // 'unbilled', 'lastMonth', 'custom'
    const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
    const [activityData, setActivityData] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    //console.log(projectRecords)
    //console.log("customer",customer)

    // Handler for QuickBooks initialization
    const handleQuickBooksInit = useCallback(async () => {
        if (!customer || !customer.id) {
            showError('Customer information is missing');
            return;
        }
        
        setIsProcessingQB(true);
        try {
            await initializeQuickBooks(customer.id);
            showError('QuickBooks processing initiated successfully');
        } catch (error) {
            console.error('QuickBooks initialization error:', error);
            showError(`Error processing QuickBooks: ${error.message}`);
        } finally {
            setIsProcessingQB(false);
        }
    }, [customer, showError]);

    // Calculate stats for display
    const stats = useMemo(() => {
        if (!projects || !projectRecords) return null;
        
        const activeProjects = projects.filter(p => p.status === 'Open');
        return {
            total: projects.length,
            open: activeProjects.length,
            unbilledHours: calculateRecordsUnbilledHours(projectRecords, true, customer.id)
        };
    }, [projects, projectRecords]);

    // Memoized project grouping with error handling
    const { activeProjects, closedProjects, groupingError } = useMemo(() => {
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
            
            return { ...result, groupingError: null };
        } catch (error) {
            console.error('Error grouping projects:', error);
            return {
                activeProjects: [],
                closedProjects: [],
                groupingError: error.message
            };
        }
    }, [projects]);

    // Memoized handlers
    const handleProjectCreate = useCallback(() => {
        // Show the project creation form instead of directly creating the project
        setShowNewProjectInput(true);
    }, []);
    
    // Handle project form submission
    const handleProjectFormSubmit = useCallback((projectName) => {
        console.log('Creating new project for customer:', {
            id: customer.id,
            name: customer.Name,
            projectName
        });
        
        const projectData = {
            customerId: customer.id,
            customerName: customer.Name,
            name: projectName,        // For formatProjectForFileMaker
            projectName: projectName, // For validateProjectData
            _custID: customer.id      // For validateProjectData
        };
        
        console.log('Project data being passed to onProjectCreate:', projectData);
        onProjectCreate(projectData);
        setShowNewProjectInput(false);
    }, [customer, onProjectCreate]);

    // Function to fetch activity data based on the selected timeframe
    const fetchActivityData = useCallback(async () => {
        console.log('[DEBUG] fetchActivityData called with:', {
            customerId: customer?.id,
            timeframe: activityTimeframe,
            customDateRange
        });
        
        if (!customer || !customer.id) {
            showError('Customer information is missing');
            return;
        }

        setLoadingActivity(true);
        try {
            // Map our UI timeframe to API timeframe
            let apiTimeframe;
            if (activityTimeframe === 'unbilled') {
                apiTimeframe = 'unbilled';
            } else if (activityTimeframe === 'lastMonth') {
                apiTimeframe = 'lastmonth';
            } else if (activityTimeframe === 'custom') {
                apiTimeframe = 'custom';
            }

            console.log('[DEBUG] Calling fetchCustomerActivityData with:', {
                apiTimeframe,
                customerId: customer.id,
                dateRange: activityTimeframe === 'custom' ? customDateRange : null
            });
            
            // Fetch activity data using the dedicated function with proper AND query
            const data = await fetchCustomerActivityData(
                apiTimeframe,
                customer.id,
                activityTimeframe === 'custom' ? customDateRange : null
            );
            
            // Process the raw data using our dedicated activity data processor
            const processedData = processActivityData(data);
            console.log('[DEBUG] Processed data length:', processedData.length);
            
            // Format records for display using our dedicated formatter
            const formattedRecords = processedData.map(record => formatActivityRecordForDisplay(record));
            
            setActivityData(formattedRecords);
        } catch (error) {
            console.error('Error fetching activity data:', error);
            showError(`Error loading activity data: ${error.message}`);
            setActivityData([]);
        } finally {
            setLoadingActivity(false);
        }
    }, [customer, activityTimeframe, customDateRange, showError]);

    // Fetch activity data when the modal is opened or timeframe changes
    useEffect(() => {
        console.log('[DEBUG] Activity Report useEffect triggered:', {
            showActivityReport,
            customerId: customer?.id,
            activityTimeframe
        });
        
        if (showActivityReport && customer?.id) {
            fetchActivityData();
        }
    }, [showActivityReport, activityTimeframe, customer]);

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            {/* Customer Header */}
            <div className={`
                border-b pb-4
                ${darkMode ? 'border-gray-700' : 'border-gray-200'}
            `}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">{customer.Name}</h2>
                        <div className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {customer.Email && (
                                <span className="mr-4">
                                    {customer.Email}
                                </span>
                            )}
                            {customer.Phone && (
                                <span>{customer.Phone}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        {/* <button
                            onClick={handleQuickBooksInit}
                            disabled={isProcessingQB}
                            className={`
                                px-4 py-2 rounded-md flex items-center
                                ${isProcessingQB
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white'}
                            `}
                            title="Send unbilled records to QuickBooks"
                        >
                            <span>qb</span>
                        </button> */}
                        <button
                            onClick={() => setShowActivityReport(true)}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            Activity Report
                        </button>
                        <button
                            onClick={handleProjectCreate}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                        >
                            New Project
                        </button>
                    </div>
                </div>

                {stats && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total Projects
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.total}
                            </div>
                        </div>
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Active Projects
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.open}
                            </div>
                        </div>
                        <div className={`
                            p-3 rounded-lg
                            ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
                        `}>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Unbilled Hours
                            </div>
                            <div className="text-2xl font-semibold mt-1">
                                {stats.unbilledHours} hrs
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Project Creation Form */}
            {showNewProjectInput && (
                <div className="mb-6">
                    <TextInput
                        title="Create New Project"
                        placeholder="Enter project name..."
                        submitLabel="Create"
                        onSubmit={handleProjectFormSubmit}
                        onCancel={() => setShowNewProjectInput(false)}
                    />
                </div>
            )}

            {/* Activity Report Modal with Data Fetching */}
            {showActivityReport && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`
                        w-3/4 max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg shadow-xl
                        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
                        p-6
                    `}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Activity Report: {customer.Name}</h2>
                            <button
                                onClick={() => setShowActivityReport(false)}
                                className={`${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Timeframe Selector */}
                        <div className={`
                            flex space-x-4 mb-6 p-3 rounded-lg
                            ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                        `}>
                            <button
                                onClick={() => setActivityTimeframe('unbilled')}
                                className={`
                                    px-4 py-2 rounded-md transition-colors
                                    ${activityTimeframe === 'unbilled'
                                        ? 'bg-primary text-white'
                                        : darkMode
                                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                                `}
                            >
                                Unbilled Activity
                            </button>
                            <button
                                onClick={() => setActivityTimeframe('lastMonth')}
                                className={`
                                    px-4 py-2 rounded-md transition-colors
                                    ${activityTimeframe === 'lastMonth'
                                        ? 'bg-primary text-white'
                                        : darkMode
                                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                                `}
                            >
                                Last Month
                            </button>
                            <button
                                onClick={() => setActivityTimeframe('custom')}
                                className={`
                                    px-4 py-2 rounded-md transition-colors
                                    ${activityTimeframe === 'custom'
                                        ? 'bg-primary text-white'
                                        : darkMode
                                            ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                                `}
                            >
                                Custom Range
                            </button>
                        </div>
                        
                        {/* Custom Date Range Selector */}
                        {activityTimeframe === 'custom' && (
                            <div className={`
                                flex space-x-4 mb-6 p-4 rounded-lg
                                ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                            `}>
                                <div className="flex flex-col">
                                    <label className="mb-1 text-sm">Start Date</label>
                                    <input
                                        type="date"
                                        value={customDateRange.start || ''}
                                        onChange={(e) => setCustomDateRange({
                                            ...customDateRange,
                                            start: e.target.value
                                        })}
                                        className={`
                                            px-3 py-2 rounded-md border
                                            ${darkMode
                                                ? 'bg-gray-600 border-gray-500 text-white'
                                                : 'bg-white border-gray-300 text-gray-700'}
                                        `}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="mb-1 text-sm">End Date</label>
                                    <input
                                        type="date"
                                        value={customDateRange.end || ''}
                                        onChange={(e) => setCustomDateRange({
                                            ...customDateRange,
                                            end: e.target.value
                                        })}
                                        className={`
                                            px-3 py-2 rounded-md border
                                            ${darkMode
                                                ? 'bg-gray-600 border-gray-500 text-white'
                                                : 'bg-white border-gray-300 text-gray-700'}
                                        `}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={() => fetchActivityData()}
                                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Activity Content */}
                        <div className={`
                            rounded-lg border
                            ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                        `}>
                            <table className="w-full">
                                <thead className={`
                                    ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}
                                    border-b
                                    ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                                `}>
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Project</th>
                                        <th className="px-4 py-3 text-left">Description</th>
                                        <th className="px-4 py-3 text-right">Hours</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {loadingActivity ? (
                                        <tr className={darkMode ? 'bg-gray-800' : 'bg-white'}>
                                            <td colSpan="6" className="px-4 py-8 text-center">
                                                <div className="text-lg font-medium">Loading activity data...</div>
                                            </td>
                                        </tr>
                                    ) : activityData.length === 0 ? (
                                        <tr className={darkMode ? 'bg-gray-800' : 'bg-white'}>
                                            <td colSpan="6" className="px-4 py-8 text-center">
                                                <div className="text-lg font-medium mb-2">
                                                    {activityTimeframe === 'unbilled' && 'No Unbilled Activity'}
                                                    {activityTimeframe === 'lastMonth' && 'No Activity Last Month'}
                                                    {activityTimeframe === 'custom' && 'No Activity in Selected Range'}
                                                </div>
                                                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    Try selecting a different timeframe or date range.
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        activityData.map(record => (
                                            <tr key={record.id} className={darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}>
                                                <td className="px-4 py-3">{record.date}</td>
                                                <td className="px-4 py-3">{record.projectName}</td>
                                                <td className="px-4 py-3">{record.description}</td>
                                                <td className="px-4 py-3 text-right">{record.hours}</td>
                                                <td className="px-4 py-3 text-right">{record.amount}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`
                                                        px-2 py-1 text-xs rounded-full
                                                        ${record.billed
                                                            ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                                                            : (darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')}
                                                    `}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowActivityReport(false)}
                                className={`
                                    px-4 py-2 rounded-md mr-3
                                    ${darkMode
                                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                                `}
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    console.log("Export Report button clicked");
                                    console.log("Activity data:", activityData);
                                    
                                    try {
                                        // Use the new pdfReportService which can handle any type of records
                                        Promise.all([
                                            import('../../utils/pdfReportService'),
                                            import('../../utils/pdfUtils')
                                        ]).then(([{ generateCustomerProjectReport }, { downloadPdf }]) => {
                                            console.log("Imported PDF utilities");
                                            
                                            // Generate the report using the activity data
                                            generateCustomerProjectReport(
                                                activityData,
                                                customer.id,
                                                {
                                                    title: `Activity Report: ${customer.Name}`,
                                                    dateRange: activityTimeframe === 'unbilled'
                                                        ? 'Unbilled Activity'
                                                        : activityTimeframe === 'lastMonth'
                                                            ? 'Last Month'
                                                            : 'Custom Date Range',
                                                    fileName: `${customer.Name.replace(/\s+/g, '-').toLowerCase()}-activity-report.pdf`
                                                }
                                            ).then(report => {
                                                // Download the PDF using the utility function
                                                return downloadPdf(report).then(() => {
                                                    console.log("PDF report saved");
                                                });
                                            }).catch(error => {
                                                console.error("Error generating report:", error);
                                                showError(`Error generating report: ${error.message}`);
                                            });
                                        }).catch(error => {
                                            console.error("Error importing PDF modules:", error);
                                            showError(`Error importing PDF modules: ${error.message}`);
                                        });
                                    } catch (error) {
                                        console.error("Error generating PDF report:", error);
                                        showError(`Error generating PDF: ${error.message}`);
                                    }
                                }}
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors duration-150"
                            >
                                Export Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Active Projects */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Active Projects ({activeProjects.length})</h3>
                {!groupingError && activeProjects.length > 0 ? (
                    <div className="max-h-[400px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            {activeProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    darkMode={darkMode}
                                    onSelect={onProjectSelect}
                                    setLoading={setLoading}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={`
                        text-center py-8 rounded-lg border
                        ${darkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-400'
                            : 'bg-gray-50 border-gray-200 text-gray-500'}
                    `}>
                        No active projects
                    </div>
                )}
            </div>

            {/* Closed Projects */}
            {closedProjects.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Closed Projects ({closedProjects.length})</h3>
                    <div className="max-h-[300px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            {closedProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    darkMode={darkMode}
                                    onSelect={onProjectSelect}
                                    setLoading={setLoading}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
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