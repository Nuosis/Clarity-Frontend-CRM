import React, { useEffect } from 'react';
import { createRoot } from "react-dom/client";
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store } from './store';
import Stats from './components/Stats';
import Loading from './components/Loading';
import Project from './components/Project';
import Menu from './components/Menu';
import { transformJsonForAccordionMenu } from './utils';
import { setBillablesData } from './store/billablesSlice';
import { setProjectData, setLoading, setError } from './store/projectSlice';
import { setCurrentStaffId } from './store/staffSlice';
import { fetchTaskData } from './store/taskSlice';
import './style.css';

// Function to fetch data from FileMaker
function fetchDataFromFileMaker(callback, attempt = 0) {
    console.log("Attempting to fetch data from FileMaker, attempt:", attempt);
    
    if (typeof FileMaker !== "undefined" && FileMaker.PerformScript) {
        console.log("FileMaker object found. Requesting data...");
        FileMaker.PerformScript("staff * JS * Project Data");
    } else if (attempt < 10) {
        setTimeout(() => fetchDataFromFileMaker(callback, attempt + 1), 100);
    } else {
        console.error("Error: FileMaker object is unavailable.");
        callback({ error: true, message: "FileMaker object is unavailable." });
    }
}

function App() {
    const dispatch = useDispatch();
    const { projectData, error } = useSelector(state => state.project);
    const { billablesData } = useSelector(state => state.billables);
    const currentStaffId = useSelector(state => state.staff.currentStaffId);
    const [data, setData] = React.useState(null);
    const [update, setUpdate] = React.useState("[]");
    const [displayStats, setDisplayStats] = React.useState(false);

    // loadData
    useEffect(() => {
        window.loadData = (fileMakerData) => {
            try {
                const parsedData = JSON.parse(fileMakerData);
                // Set staff ID if available
                if (parsedData.staffID) {
                    dispatch(setCurrentStaffId(parsedData.staffID));
                    // Fetch tasks for the current staff
                    dispatch(fetchTaskData({
                        query: `[{"_staffID":"${parsedData.staffID}"}]`,
                        action: "read"
                    }));
                } 

                dispatch(setProjectData(parsedData.response.data));

                const transformedData = transformJsonForAccordionMenu(parsedData);
                console.log({transformedData});
                setData(transformedData);
            } catch (error) {
                console.error("Error parsing data from FileMaker:", error);
                setData({ error: true, message: "Failed to parse data from FileMaker." });
            }
        };

        // Fetch data only once on mount
        fetchDataFromFileMaker((result) => {
            setData(result);
        });

        // Cleanup global function to avoid memory leaks
        return () => {
            window.loadData = undefined;
        };
    }, [dispatch]);

    // loadBillables
    window.loadBillables = (fileMakerData) => {
        try {
            const parsedData = JSON.parse(fileMakerData);
            console.log("billablesData: ", {parsedData});
            // Pass the array of records directly to setBillablesData
            dispatch(setBillablesData(parsedData.response.data));
            setDisplayStats(true);
        } catch (error) {
            console.error("Error parsing data from FileMaker:", error);
            dispatch(setError("Failed to parse billable data from FileMaker."));
        }
    };

    // processUpdate
    useEffect(() => {
        if (update !== "[]") {
            FileMaker.PerformScript("staff * JS * Callback", JSON.stringify(update));
            setUpdate("[]");
        }
    }, [update]);

    // Force hard reload to bypass cache
    useEffect(() => {
        window.onload = () => {
            window.location.reload(true); 
        };
    }, []);

    return (
        <div className="">
            {data === null ? (
                <Loading message="Loading data, please wait" />
            ) : data.error ? (
                <div className="text-red-500 text-center py-4">{data.message}</div>
            ) : (
                <div id='layout-container' className="flex h-screen">
                    <div id='menu-container' className="w-[211] h-screen bg-gray-100 shadow-md pr-[5px]">
                        <Menu items={data} />
                    </div>
                    <div id='project-container' className="flex-grow bg-white py-2">
                        {displayStats ? (
                            <Stats onClose={() => setDisplayStats(false)} />
                        ) : (
                            <Project setUpdate={setUpdate} />
                        )}
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
