import React, { useState, useEffect } from 'react';
import Loading from './components/loading/Loading';
import FMGofer from 'fm-gofer';
import AppLayout from './components/layout/AppLayout';
import Sidebar from './components/layout/Sidebar';
import CustomerDetails from './components/customers/CustomerDetails';
import ProjectDetails from './components/projects/ProjectDetails';
import TaskTimer from './components/tasks/TaskTimer';
import { useTheme } from './components/layout/AppLayout';

// FileMaker integration functions
async function fetchDataFromFileMaker(callback, params, attempt = 0) {
    console.log("Attempting to fetch data from FileMaker");
    
    if (attempt >= 10) {
        console.error("Error: FileMaker object is unavailable after 1 second.");
        callback({ 
            error: true, 
            message: "Failed to fetch data from FileMaker.",
            details: "FileMaker object is unavailable after 1 second." 
        });
        return;
    }

    if (typeof FileMaker === "undefined" || !FileMaker.PerformScript) {
        setTimeout(() => fetchDataFromFileMaker(callback, params, attempt + 1), 100);
        return;
    }

    try {
        console.log(params)
        const param = JSON.stringify(params)
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

// Data processing functions
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
    const { darkMode } = useTheme();
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
        let mounted = true;
        const fetchAllData = async () => {
            try {
                const [userContextResult, customerResult] = await Promise.all([
                    new Promise(resolve => {
                        fetchDataFromFileMaker(resolve, { "action": "returnContext" });
                    }),
                    new Promise(resolve => {
                        fetchDataFromFileMaker(resolve, {
                            "action": "read",
                            "layout": "devCustomers",
                            "version": "vLatest",
                            "query": [{"__ID": "*"}],
                        });
                    })
                ]);

                if (userContextResult?.error || customerResult?.error) {
                    throw new Error("Failed to fetch initial data");
                }

                const user = userContextResult;
                const customer = customerResult;
                const activeCustomers = await processCustomerData(customer);

                if (activeCustomers?.length) {
                    const customerIds = activeCustomers.map(customer => customer.fieldData.__ID);
                    const projectResult = await new Promise(resolve => {
                        fetchProjectsForCustomers(customerIds, resolve);
                    });

                    if (projectResult?.response?.data?.length) {
                        const projectIds = projectResult.response.data.map(project => project.fieldData.__ID);
                        const [imagesData, linksData, objectivesData, stepsData] = await Promise.all([
                            new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectImages", resolve)),
                            new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectLinks", resolve)),
                            new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectObjectives", resolve)),
                            new Promise(resolve => fetchProjectRelatedData(projectIds, "devProjectObjSteps", resolve))
                        ]);

                        const enrichedProjects = await processProjectData(
                            projectResult, imagesData, linksData, objectivesData, stepsData
                        );
                        if (mounted) setProjects(enrichedProjects);
                    }
                }

                if (mounted) {
                    setUser(user);
                    setCustomers(customer);
                    setActiveCustomers(activeCustomers);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        
        fetchAllData();
        return () => { mounted = false; };
    }, []);

    // Task Management Handlers
    const handleTaskCreate = async (taskData) => {
        try {
            const result = await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devTasks",
                    action: "create",
                    fieldData: {
                        ...taskData,
                        f_completed: false
                    }
                });
            });

            if (result?.error) {
                throw new Error(result.message);
            }

            // Update local state
            setProjects(prevProjects => 
                prevProjects.map(project => {
                    if (project.__ID === taskData._projectID) {
                        return {
                            ...project,
                            tasks: [...(project.tasks || []), {
                                ...taskData,
                                __ID: result.recordId,
                                f_completed: false
                            }]
                        };
                    }
                    return project;
                })
            );
        } catch (error) {
            console.error("Error creating task:", error);
        }
    };

    const handleTaskUpdate = async (taskData) => {
        try {
            const result = await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devTasks",
                    action: "update",
                    recordId: taskData.__ID,
                    fieldData: taskData
                });
            });

            if (result?.error) {
                throw new Error(result.message);
            }

            // Update local state
            setProjects(prevProjects => 
                prevProjects.map(project => {
                    if (project.__ID === taskData._projectID) {
                        return {
                            ...project,
                            tasks: project.tasks.map(task => 
                                task.__ID === taskData.__ID ? { ...task, ...taskData } : task
                            )
                        };
                    }
                    return project;
                })
            );
        } catch (error) {
            console.error("Error updating task:", error);
        }
    };

    const handleTaskStatusChange = async (taskId, completed) => {
        try {
            const result = await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devTasks",
                    action: "update",
                    recordId: taskId,
                    fieldData: {
                        f_completed: completed
                    }
                });
            });

            if (result?.error) {
                throw new Error(result.message);
            }

            // Update local state
            setProjects(prevProjects => 
                prevProjects.map(project => ({
                    ...project,
                    tasks: project.tasks?.map(task => 
                        task.__ID === taskId 
                            ? { ...task, f_completed: completed }
                            : task
                    )
                }))
            );
        } catch (error) {
            console.error("Error updating task status:", error);
        }
    };

    // Timer Handlers
    const handleTimerStart = async () => {
        try {
            const startTime = new Date().toISOString();
            const result = await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devRecords",
                    action: "create",
                    fieldData: {
                        startTime,
                        taskId: selectedTask.__ID
                    }
                });
            });

            if (result?.error) {
                throw new Error(result.message);
            }

            setTimer({
                startTime,
                taskId: selectedTask.__ID,
                recordId: result.recordId
            });
        } catch (error) {
            console.error("Error starting timer:", error);
        }
    };

    const handleTimerPause = () => {
        setTimer(prev => ({
            ...prev,
            isPaused: !prev.isPaused
        }));
    };

    const handleTimerStop = async (saveImmediately, description = '') => {
        try {
            const endTime = new Date().toISOString();
            const result = await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devRecords",
                    action: "update",
                    recordId: timer.recordId,
                    fieldData: {
                        endTime,
                        description: saveImmediately ? 'Time logged' : description
                    }
                });
            });

            if (result?.error) {
                throw new Error(result.message);
            }

            setTimer(null);
        } catch (error) {
            console.error("Error stopping timer:", error);
        }
    };

    const handleTimerAdjust = (minutes) => {
        setTimer(prev => ({
            ...prev,
            adjustment: (prev.adjustment || 0) + minutes
        }));
    };

    // Selection Handlers
    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setSelectedProject(null);
        setSelectedTask(null);
    };

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setSelectedTask(null);
    };

    const handleProjectStatusChange = async (projectId, newStatus) => {
        try {
            await new Promise(resolve => {
                fetchDataFromFileMaker(resolve, {
                    layout: "devProjects",
                    action: "update",
                    recordId: projectId,
                    fieldData: {
                        status: newStatus
                    }
                });
            });

            setProjects(prevProjects => 
                prevProjects.map(project => 
                    project.__ID === projectId 
                        ? { ...project, status: newStatus }
                        : project
                )
            );
        } catch (error) {
            console.error("Error updating project status:", error);
        }
    };

    if (loading) {
        return <Loading message="Loading data, please wait" />;
    }

    return (
        <AppLayout>
            <Sidebar
                customers={customers?.response?.data || []}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={handleCustomerSelect}
            />
            <div className={`flex-1 p-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {selectedTask ? (
                    <div className="space-y-6">
                        <button
                            onClick={() => setSelectedTask(null)}
                            className={`
                                text-sm px-3 py-1 rounded-md
                                ${darkMode 
                                    ? 'bg-gray-700 hover:bg-gray-600' 
                                    : 'bg-gray-200 hover:bg-gray-300'}
                            `}
                        >
                            ← Back to Project
                        </button>
                        <TaskTimer
                            task={selectedTask}
                            onStart={handleTimerStart}
                            onPause={handleTimerPause}
                            onStop={handleTimerStop}
                            onAdjust={handleTimerAdjust}
                        />
                    </div>
                ) : selectedProject ? (
                    <ProjectDetails
                        project={selectedProject}
                        onTaskSelect={setSelectedTask}
                        onStatusChange={handleProjectStatusChange}
                        onTaskCreate={handleTaskCreate}
                        onTaskUpdate={handleTaskUpdate}
                        onTaskStatusChange={handleTaskStatusChange}
                    />
                ) : selectedCustomer ? (
                    <CustomerDetails
                        customer={selectedCustomer}
                        projects={projects || []}
                        onProjectSelect={handleProjectSelect}
                    />
                ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        Select a customer to view details
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

console.log("version 1.0.11")
export default App;
