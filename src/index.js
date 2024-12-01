import React, { useEffect } from 'react';
import { createRoot } from "react-dom/client";
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store } from './store';
import Stats from './components/Stats';
import Customers from './components/Customers';
import CustomerDetails from './components/CustomerDetails';
import Loading from './components/Loading';
import Project from './components/Project';
import Menu from './components/Menu';
import { transformJsonForAccordionMenu } from './utils';
import { setBillablesData, fetchBillablesData } from './store/billablesSlice';
import { refreshProjects, setError } from './store/projectSlice';
import { setCurrentStaffId } from './store/staffSlice';
import { fetchTaskData } from './store/taskSlice';
import FMGofer from 'fm-gofer';
import './style.css';
import { stringify } from 'postcss';

function App() {
    const dispatch = useDispatch();
    const { projectData, error } = useSelector(state => state.project);
    const { billablesData, lastFetched } = useSelector(state => state.billables);
    const currentStaffId = useSelector(state => state.staff.currentStaffId);
    const [data, setData] = React.useState(null);
    const [displayComponent, setDisplayComponent] = React.useState(null);

    // Initial data load
    useEffect(() => {
        const initializeData = async () => {
            try {
                // Get staff ID
                const staffResponse = await FMGofer.PerformScript('staff * JS * Staff ID');
                const staffData = typeof staffResponse === 'string' ? JSON.parse(staffResponse) : await staffResponse.json();
                const staffId = staffData.staffID;

                if (staffId) {
                    // Set staff ID in Redux
                    dispatch(setCurrentStaffId(staffId));
                    
                    // Load tasks and projects concurrently
                    await Promise.all([
                        // Fetch tasks for the current staff
                        dispatch(fetchTaskData({
                            query: `[{"_staffID":"${staffId}"}]`,
                            action: "read"
                        })),

                        // Fetch and process projects
                        (async () => {
                            const projectsResponse = await dispatch(refreshProjects(staffId));
                            if (projectsResponse.payload) {
                                const dataForTransform = {
                                    response: {
                                        data: projectsResponse.payload
                                    }
                                };
                                const transformedData = transformJsonForAccordionMenu(dataForTransform);
                                console.log('Transformed menu data:', transformedData);
                                setData(transformedData);
                            }
                        })()
                    ]);

                    // After tasks and projects are loaded, initialize billables
                    FileMaker.PerformScript('staff * JS * Billables Data', JSON.stringify({
                        type: "all",
                        scope: "5years",
                        lastFetched: lastFetched
                    }));
                }
            } catch (error) {
                console.error("Error initializing data:", error);
                setData({ error: true, message: "Failed to initialize data." });
            }
        };

        initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update window.billables whenever billablesData changes
    useEffect(() => {
        window.billables = billablesData;
    }, [billablesData]);

    // loadBillables
    window.loadBillables = (fileMakerData) => {
        try {
            const parsedData = JSON.parse(fileMakerData);
            console.log("billablesData: ", parsedData.response.data);
            // Pass the array of records directly to setBillablesData
            dispatch(setBillablesData(parsedData.response.data));
        } catch (error) {
            console.error("Error parsing data from FileMaker:", error);
            dispatch(setError("Failed to parse billable data from FileMaker."));
        }
    };

    window.loadCustomers = () => {
      setDisplayComponent('customers');
    };

    window.loadStats = () => {
      setDisplayComponent('stats');
    };

    // loadCustomer
    const handleLoadCustomer = () => {
        if (!billablesData || billablesData.length === 0) {
            dispatch(fetchBillablesData({
                action: "read",
                query: `[{"_staffID":"${currentStaffId}"}]`
            }));
        }
        setDisplayComponent('customerDetails');
    };

    const renderComponent = () => {
        switch(displayComponent) {
            case 'customers':
                return <Customers onClose={() => setDisplayComponent(null)} />;
            case 'customerDetails':
                return <CustomerDetails onClose={() => setDisplayComponent(null)} />;
            case 'stats':
                return <Stats onClose={() => setDisplayComponent(null)} />;
            default:
                return <Project loadCustomer={handleLoadCustomer} />;
        }
    };

    return (
        <div className="">
            {data === null ? (
                <Loading message="Loading data, please wait" />
            ) : data.error ? (
                <div className="text-red-500 text-center py-4">{data.message}</div>
            ) : (
                <div id='layout-container' className="flex h-screen">
                    <div id='menu-container' className="w-[211] h-screen bg-gray-100 shadow-md pr-[5px]">
                        <Menu items={data} onSelect={() => {setDisplayComponent(null)}} />
                    </div>
                    <div id='project-container' className="flex-grow bg-white py-2">
                        {renderComponent()}
                    </div>
                </div>
            )}
        </div>
    );
}

// Wrap App with Redux Provider
const AppWrapper = () => (
    <Provider store={store}>
        <App />
    </Provider>
);

// Render the App to the root element
console.log("version 1.0.4");
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<AppWrapper />);
