import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { recordQueueManager } from '../services/recordQueueManager';
import { Layouts, Actions, fetchDataFromFileMaker } from '../api';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
    const [projectRecords, setProjectRecords] = useState(null);
    const [projectContext, setProjectContext] = useState(null);
    const recordsFetched = useRef(false);
    const contextFetched = useRef(false);

    // Fetch records and context once on mount
    useEffect(() => {
        if (!recordsFetched.current) {
            recordsFetched.current = true;
            
            const now = new Date();
            const monthsAgo = new Date(now.setMonth(now.getMonth() - 12));
            const startMonth = String(monthsAgo.getMonth() + 1).padStart(2, '0');
            const startYear = monthsAgo.getFullYear();

            console.log('[ProjectContext] Fetching project records');
            const params = {
                layout: Layouts.RECORDS,
                action: Actions.READ,
                callBackName: "returnRecords",
                query: [
                    { DateStart: `>${startYear.toString()}+${startMonth-1}+*` },
                ]
            };
            
            recordQueueManager.enqueue(params, (data) => {
                console.log('[ProjectContext] Project records received:', {
                    count: data?.length || 0,
                    sample: data?.[0]
                });
                setProjectRecords(data);
            });
        }

        // TODO: Uncomment when CONTEXT layout is properly defined
        // if (!contextFetched.current) {
        //     contextFetched.current = true;
        //
        //     console.log('[ProjectContext] Fetching project context');
        //     const contextParams = {
        //         layout: Layouts.CONTEXT,
        //         action: Actions.READ,
        //         callBackName: "returnContext"
        //     };

        //     // Since returnContext is working directly, we don't need to use the queue
        //     window.returnContext = (d) => {
        //         const data = JSON.parse(d);
        //         if (data?.response?.data) {
        //             console.log('[ProjectContext] Project context received:', {
        //                 sample: data.response.data[0]
        //             });
        //             setProjectContext(data.response.data);
        //         }
        //     };

        //     // Trigger the context fetch
        //     fetchDataFromFileMaker(contextParams, 0, false);
        // }
    }, []);

    const value = {
        projectRecords,
        projectContext
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProjectRecords() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProjectRecords must be used within a ProjectProvider');
    }
    return context.projectRecords;
}
// TODO: Uncomment when CONTEXT layout is properly defined
// export function useProjectContext() {
//     const context = useContext(ProjectContext);
//     if (context === undefined) {
//         throw new Error('useProjectContext must be used within a ProjectProvider');
//     }
//     return context.projectContext;
// }