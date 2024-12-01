import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedProject, setSelectedCustomer } from '../store/projectSlice';
import { fetchTaskData } from '../store/taskSlice';
import '../style.css';

function MenuItem({ name, onClick, isSelected }) {
  return (
    <div
      className={`menu-item pl-4 pr-9 py-2 cursor-pointer flex justify-end border-b w-[211px]
      ${isSelected ? 'bg-[#002C3E] text-white font-bold' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
      onClick={onClick}
      style={{ 
        fontFamily: 'Helvetica Neue',
        textAlign: 'right', 
      }}
    >
      {name}
    </div>
  );
}

function SubMenu({ items, onSubItemClick, selectedSubItemId }) {
  return (
    <ul className="submenu flex flex-col w-[211px]">
      {items.map((subItem, index) => (
        <li
          key={index}
          className={`submenu-item pl-4 pr-12 border-b py-1 text-gray-400 hover:text-slate-800 hover:bg-gray-100 cursor-pointer
            ${
              subItem.id === selectedSubItemId
                ? 'bg-gray-200 font-semibold'
                : 'hover:bg-gray-100'
            }`}
          onClick={() => onSubItemClick(subItem)}
          style={{ 
            fontFamily: 'Helvetica Neue',
            textAlign: 'right', 
          }}
        >
          {subItem.name}
        </li>
      ))}
    </ul>
  );
}

function Menu({ items, onSelect }) {
  const dispatch = useDispatch();
  const selectedCustomer = useSelector(state => state.project.selectedCustomer);
  const selectedProject = useSelector(state => state.project.selectedProject);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);

  const handleItemClick = (item) => {
    // If clicking the same customer, deselect it
    if (selectedCustomer === item.name) {
      dispatch(setSelectedCustomer(null));
      dispatch(setSelectedProject(null));
      
      // Fetch all tasks for the staff
      if (currentStaffId) {
        dispatch(fetchTaskData({
          query: `[{"_staffID":"${currentStaffId}"}]`,
          action: "read"
        }));
      }
    } else {
      // Select the new customer
      dispatch(setSelectedCustomer(item.name));
      dispatch(setSelectedProject(null));
      
      // Fetch tasks for the selected customer
      if (currentStaffId) {
        const customerProjects = item.submenu.map(project => project.id);
        const projectQuery = customerProjects.map(projectId => ({
          _projectID: projectId,
          _staffID: currentStaffId
        }));
        
        dispatch(fetchTaskData({
          query: JSON.stringify(projectQuery),
          action: "read"
        }));
      }
    }
    onSelect()
  };

  const handleSubItemClick = (subItem) => {
    dispatch(setSelectedProject(subItem));
    
    // Fetch tasks for the selected project
    if (currentStaffId) {
      dispatch(fetchTaskData({
        query: `[{"_projectID":"${subItem.id}","_staffID":"${currentStaffId}"}]`,
        action: "read"
      }));
    }
  };

  return (
    <nav
      className="menu w-[211px] h-full overflow-y-scroll overflow-x-hidden bg-white border-r border-gray-300"
      style={{
        scrollbarWidth: 'thin',
        fontFamily: 'Helvetica Neue',
      }}
    >
      {items.map((item) => (
        <div key={item.id} className="menu-section">
          <MenuItem
            name={item.name}
            isSelected={item.name === selectedCustomer}
            onClick={() => handleItemClick(item)}
          />
          {item.name === selectedCustomer && 
            <SubMenu 
              items={item.submenu} 
              onSubItemClick={handleSubItemClick}
              selectedSubItemId={selectedProject?.id}
            />}
        </div>
      ))}
    </nav>
  );
}

export default Menu;
