import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { recordQueueManager } from '../services/recordQueueManager';
import { Layouts, Actions } from '../api';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
    const [projectRecords, setProjectRecords] = useState(null);
    const recordsFetched = useRef(false);

    // Fetch records once on mount
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
    }, []);

    const value = {
        projectRecords
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