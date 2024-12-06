import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchProjectData } from '../store/projectSlice';
import EditProject from './EditProject';
import Charts from './Chart';
import QBIcon from '../assets/QB.png';

export default function CustomerDetails({ onClose }) {
  const dispatch = useDispatch();
  const [selectedProject, setSelectedProject] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const selectedCustomer = useSelector(state => state.project.selectedCustomer);
  const projects = useSelector(state => state.project.projectData);
  const teams = useSelector(state => state.teams.teams);
  const billables = useSelector(state => state.billables.billablesData);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);

  // Get total billable hours for current month
  const totalMonthlyHours = useMemo(() => {
    if (!billables?.length) return 0;
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    return billables
      .filter(entry => {
        const entryData = entry.fieldData || entry;
        if (entryData.f_dnb === "1" || entryData.f_omit === "1") return false;
        if (entryData["Customers::Name"] !== selectedCustomer) return false;
        
        const [year, month] = entryData.DateStart.split('-');
        return parseInt(year) === currentYear && parseInt(month) === currentMonth;
      })
      .reduce((total, entry) => {
        const entryData = entry.fieldData || entry;
        return total + (parseFloat(entryData.Billable_Time_Rounded) || 0);
      }, 0);
  }, [billables, selectedCustomer]);

  // Filter and sort projects for this customer
  const customerProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects
      .filter(project => project.fieldData["Customers::Name"] === selectedCustomer)
      .sort((a, b) => {
        // First sort by status (Open first)
        if (a.fieldData.status === "Open" && b.fieldData.status !== "Open") return -1;
        if (a.fieldData.status !== "Open" && b.fieldData.status === "Open") return 1;
        // Then sort by name
        return a.fieldData.projectName.localeCompare(b.fieldData.projectName);
      });
  }, [projects, selectedCustomer]);

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await dispatch(fetchProjectData({
        action: 'delete',
        recordId: projectId
      }));
    }
  };

  const handleQBClick = () => {
    FileMaker.PerformScript('initialize QB via JS', selectedCustomer);
  };

  // Process billables data for line chart
  const chartData = useMemo(() => {
    if (!billables?.length) return {};

    const data = billables
      .filter(entry => {
        const entryData = entry.fieldData || entry;
        return (
          entryData["Customers::Name"] === selectedCustomer &&
          entryData.f_dnb !== "1" && 
          entryData.f_omit !== "1"
        );
      })
      .reduce((acc, entry) => {
        const entryData = entry.fieldData || entry;
        const [year, month] = entryData.DateStart.split('-');
        const key = `${year}-${month.padStart(2, '0')}`;
        const hours = parseFloat(entryData.Billable_Time_Rounded) || 0;
        const rate = parseFloat(entryData["Customers::chargeRate"]) || 0;
        const amount = hours * rate;

        // Convert to CAD if needed
        let finalAmount = amount;
        if (entryData["Customers::f_USD"] === "1") {
          finalAmount *= 1.35; // USD to CAD
        } else if (entryData["Customers::f_EUR"] === "1") {
          finalAmount *= 1.45; // EUR to CAD
        }

        acc[key] = (acc[key] || 0) + finalAmount;
        return acc;
      }, {});

    // Sort keys chronologically
    return Object.keys(data)
      .sort()
      .reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
      }, {});
  }, [billables, selectedCustomer]);

  // Process current month's hours by project
  const currentMonthProjectHours = useMemo(() => {
    if (!billables?.length) return {};

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Create a single object with project hours
    const projectHours = billables
      .filter(entry => {
        const entryData = entry.fieldData || entry;
        if (entryData.f_dnb === "1" || entryData.f_omit === "1") return false;
        if (entryData["Customers::Name"] !== selectedCustomer) return false;
        
        const [year, month] = entryData.DateStart.split('-');
        return parseInt(year) === currentYear && parseInt(month) === currentMonth;
      })
      .reduce((acc, entry) => {
        const entryData = entry.fieldData || entry;
        const projectName = entryData["customers_Projects::projectName"] || "Unassigned";
        const hours = parseFloat(entryData.Billable_Time_Rounded) || 0;
        
        acc[projectName] = (acc[projectName] || 0) + hours;
        return acc;
      }, {});

    return projectHours;
  }, [billables, selectedCustomer]);

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{selectedCustomer}</h1>
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold">
            {totalMonthlyHours.toFixed(2)} hrs this month
          </div>
          <button
            onClick={handleQBClick}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="QuickBooks Integration"
          >
            <img src={QBIcon} alt="qb" className="h-6 w-6 rounded-full object-cover" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Projects</h2>
        <div className="overflow-y-auto max-h-48 border rounded-lg">
          {customerProjects.map((project, index) => (
            <div
              key={project.recordId}
              onClick={() => {
                setSelectedProject(project);
                setIsEditModalOpen(true);
              }}
              className={`flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 ${
                project.fieldData.status === "Closed" ? "text-gray-400" : ""
              } ${index !== 0 ? "border-t" : ""}`}
            >
              <div className="flex-1">
                <span className="font-medium text-gray-500">{project.fieldData.projectName}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.recordId);
                }}
                className="p-1 hover:bg-gray-200 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-100 hover:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <Charts
            type="Bar"
            data={currentMonthProjectHours}
            title={`Hours by Project (${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})`}
            options={{ 
              format: 'hours'
            }}
          />
        </div>

        <div>
          <Charts
            type="Line"
            data={chartData}
            title="Billables Over Time (CAD)"
            options={{ 
              projection: "currentMonth",
              showProjection: true
            }}
          />
        </div>
      </div>

      <EditProject
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
      />
    </div>
  );
}
