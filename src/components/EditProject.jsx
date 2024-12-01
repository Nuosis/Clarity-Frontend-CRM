import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchProjectData, refreshProjects } from '../store/projectSlice';
import { fetchTeamsData } from '../store/teamsSlice';

export default function EditProject({ isOpen, onClose, project }) {
  const dispatch = useDispatch();
  const teams = useSelector(state => state.teams.teams);
  const currentStaffId = useSelector(state => state.staff.currentStaffId);
  const [formData, setFormData] = useState({
    projectName: '',
    status: '',
    _teamID: '',
    dataname: '',
    dataPath: '',
    username: '',
    password: ''
  });
  const [isModified, setIsModified] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);

  // Check and load teams data if needed
  useEffect(() => {
    if (!teams || teams.length === 0) {
      dispatch(fetchTeamsData({
        action: "read",
        query: `[{"__ID":"*"}]`
      }));
    }
  }, [dispatch, teams]);

  useEffect(() => {
    if (project) {
      const values = {
        projectName: project.fieldData.projectName || '',
        status: project.fieldData.status || '',
        _teamID: project.fieldData._teamID || '',
        dataname: project.fieldData.dataname || '',
        dataPath: project.fieldData.dataPath || '',
        username: project.fieldData.username || '',
        password: project.fieldData.password || ''
      };
      setOriginalValues(values);
      setFormData(values);
      setIsModified(false);
    }
  }, [project]);

  useEffect(() => {
    if (originalValues) {
      const isChanged = Object.keys(formData).some(
        key => formData[key] !== originalValues[key]
      );
      setIsModified(isChanged);
    }
  }, [formData, originalValues]);

  const handleCancel = () => {
    if (isModified && originalValues) {
      setFormData(originalValues);
      setIsModified(false);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(fetchProjectData({
      action: 'update',
      recordId: project.recordId,
      fieldData: formData
    }));
    
    // Refresh projects with current staff ID
    if (currentStaffId) {
      await dispatch(refreshProjects(currentStaffId));
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Project</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={formData.projectName}
            onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
            placeholder="Project Name"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
          />

          <select
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
          >
            <option value="">Select Status</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={formData._teamID}
            onChange={(e) => setFormData(prev => ({ ...prev, _teamID: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 block appearance-none bg-white"
          >
            <option value="">Select Team</option>
            {teams.map(team => (
              <option key={team.fieldData.__ID} value={team.fieldData.__ID}>
                {team.fieldData.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={formData.dataname}
            onChange={(e) => setFormData(prev => ({ ...prev, dataname: e.target.value }))}
            placeholder="DB Name"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
          />

          <input
            type="text"
            value={formData.dataPath}
            onChange={(e) => setFormData(prev => ({ ...prev, dataPath: e.target.value }))}
            placeholder="DB Path"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
          />

          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            placeholder="DB Username"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
          />

          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="DB Password"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-cyan-800 border border-cyan-800 rounded hover:bg-gray-100"
            >
              {isModified ? 'Cancel' : 'Close'}
            </button>
            {isModified && (
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
              >
                Update Project
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
