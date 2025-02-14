import React, { useState, useEffect } from 'react';
import Loading from './components/loading/Loading';
import FMGofer from 'fm-gofer';

// Function to fetch data from FileMaker
async function fetchDataFromFileMaker(callback, params, attempt = 0) {
    console.log("Attempting to fetch data from FileMaker");
    
    // Check if we've exceeded max attempts (1 second / 100ms = 10 attempts)
    if (attempt >= 10) {
        console.error("Error: FileMaker object is unavailable after 1 second.");
        callback({ 
            error: true, 
            message: "Failed to fetch data from FileMaker.",
            details: "FileMaker object is unavailable after 1 second." 
        });
        return;
    }

    // Check if FileMaker object exists
    if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
        // Wait 100ms before trying again
        setTimeout(() => fetchDataFromFileMaker(callback, params, attempt + 1), 100);
        return;
    }

    try {
        console.log(params)
        const param=JSON.stringify(params)
        const result = await FMGofer.PerformScript("JS * Fetch Data", param);
        if (!result) {
            callback({
                error: true,
                message: "Failed to fetch data from FileMaker.",
                details: "FileMaker returned null result"
            });
            return;
        }
        console.log("call result:", JSON.parse(result));
        callback(JSON.parse(result));
    } catch (error) {
        console.error("Error with FileMaker response:", error);
        callback({
            error: true,
            message: "Failed to fetch data from FileMaker.",
            details: error.message
        });
    }
}

async function processCustomerData(data) {
    try {
        console.log("Processing customer data...", data);
        if (!data?.response?.data) {
            console.error("Invalid customer data structure:", data);
            return [];
        }
        const customers = data.response.data;
        const activeCustomers = customers.filter(customer => {
            return customer.fieldData?.f_active === "1" || customer.fieldData?.f_active === 1;
        });
        console.log("Found active customers:", activeCustomers.length);
        return activeCustomers;
    } catch (error) {
        console.error('Error processing customer data:', error);
        return [];
    }
}

async function fetchProjectsForCustomers(customerIds, callback) {
    const query = customerIds.map(id => ({"_custID": id}));
    const params = {
        "layout": "devProjects",
        "version": "vLatest",
        "query": query,
        "action": "read"
    };
    console.log("projectCustomer params", params);
    return fetchDataFromFileMaker(callback, params);
}

async function fetchProjectRelatedData(projectIds, layout, callback) {
    const fieldName = layout === "devProjectImages" || layout === "devProjectLinks" ? "_fkID" : "_projectID";
    const query = projectIds.map(id => ({[fieldName]: id}));
    const params = {
        "layout": layout,
        "version": "vLatest",
        "query": query,
        "action": "read"
    };
    return fetchDataFromFileMaker(callback, params);
}

async function processProjectData(projectData, imagesData, linksData, objectivesData, stepsData) {
    try {
        const projects = projectData.response.data.map(project => {
            const projectId = project.fieldData.__ID;
            return {
                ...project.fieldData,
                images: imagesData.response.data
                    .filter(img => img.fieldData._projectID === projectId)
                    .map(img => img.fieldData),
                links: linksData.response.data
                    .filter(link => link.fieldData._projectID === projectId)
                    .map(link => link.fieldData),
                objectives: objectivesData.response.data
                    .filter(obj => obj.fieldData._projectID === projectId)
                    .map(obj => ({
                        ...obj.fieldData,
                        steps: stepsData.response.data
                            .filter(step => step.fieldData._objectiveID === obj.fieldData.__ID)
                            .map(step => step.fieldData)
                    }))
            };
        });
        return projects;
    } catch (error) {
        console.error('Error processing project data:', error);
        throw error;
    }
}
// Main App Component
function App() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [customers, setCustomers] = useState(null);
    const [activeCustomers, setActiveCustomers] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [projects, setProjects] = useState(null);
    const [tasks, setTasks] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [timer, setTimer] = useState(null);

    // Load data from FileMaker on mount
    useEffect(() => {
        const fetchAllData = async () => {
            // setLoading(true);
            try {
                // Fetch user Context
                // Fetch user context and customer data in parallel
                const [userContextResult, customerResult] = await Promise.all([
                    new Promise(resolve => {
                        const params = {
                            "action": "returnContext"
                        };
                        fetchDataFromFileMaker(resolve, params);
                    }),
                    new Promise(resolve => {
                        const query = [{"__ID": "*"}];
                        const params = {
                            "action": "read",
                            "layout": "devCustomers",
                            "version": "vLatest",
                            "query": query,
                        };
                        fetchDataFromFileMaker(resolve, params);
                    })
                ]);

                if (userContextResult?.error) {
                    console.error("Error fetching user context:", userContextResult.message, userContextResult.details);
                    throw new Error("Failed to fetch user context");
                }

                if (customerResult?.error) {
                    console.error("Error fetching customers:", customerResult.message, customerResult.details);
                    throw new Error("Failed to fetch customers");
                }

                const user = userContextResult;
                const customer = customerResult;
                const activeCustomers = await processCustomerData(customer);

                if (!activeCustomers?.length) {
                    console.log("No active customers found");
                    setProjects([]);
                    return;
                }

                console.log("Found active customers, fetching projects...");
                const customerIds = activeCustomers.map(customer => customer.fieldData.__ID);
                const projectResult = await new Promise(resolve => {
                    fetchProjectsForCustomers(customerIds, resolve);
                });

                if (!projectResult?.response?.data?.length) {
                    console.log("No projects found for active customers");
                    setProjects([]);
                    return;
                }

                const projectIds = projectResult.response.data.map(project => project.fieldData.__ID);
                console.log("Fetching related project data...");

                // Fetch all related project data in parallel
                const [imagesData, linksData, objectivesData, stepsData] = await Promise.all([
                    new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectImages", resolve)),
                    new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectLinks", resolve)),
                    new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectObjectives", resolve)),
                    new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectObjSteps", resolve))
                ]);

                // Process all project data
                const enrichedProjects = await processProjectData(projectResult, imagesData, linksData, objectivesData, stepsData);
                console.log("Setting processed projects...");

                // Batch state updates to prevent multiple rerenders
                const updates = {
                    user,
                    customers: customer,
                    activeCustomers,
                    projects: enrichedProjects
                };
                
                // Update all state at once
                Object.entries(updates).forEach(([key, value]) => {
                    const setter = {
                        'user': setUser,
                        'customers': setCustomers,
                        'activeCustomers': setActiveCustomers,
                        'projects': setProjects
                    }[key];
                    setter(value);
                });
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };
        
        console.log("starting initial data fetch");
        fetchAllData();

        let mounted = true;
        
        // Cleanup function
        return () => {
            console.log("Effect cleanup");
            mounted = false;
        };
    }, []); // Empty dependency array means this effect runs once on mount

    window.data = {
        user,
        customers,
        projects,
        tasks,
        selectedProject,
        selectedCustomer,
        selectedTask,
        activeCustomers,
        timer
    };

    // Render Loading or data display based on data availability
    return (
        <div className="p-4">
            {loading ? (
                <Loading message="Loading data, please wait" />
            ) : data.error ? (
                <div className="text-red-500 text-center py-4">
                    {data.message}
                    {data.details && <div className="text-sm mt-2">{data.details}</div>}
                </div>
            ) : (
                <pre className="whitespace-pre-wrap">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}

// Render the App to the root element
console.log("version 1.0.6")
export default App;
