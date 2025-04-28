import React, { useState, useEffect } from 'react';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  executeScript,
  uploadContainer,
  downloadContainer
} from '../../api/fileMakerEdgeFunction';

/**
 * FileMaker API Example Component
 * 
 * This component demonstrates how to use the FileMaker edge function
 * to interact with the FileMaker Data API.
 */
const FileMakerExample = () => {
  const [layout, setLayout] = useState('Customers');
  const [recordId, setRecordId] = useState('');
  const [records, setRecords] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [scriptName, setScriptName] = useState('');
  const [scriptParam, setScriptParam] = useState('');
  const [scriptResult, setScriptResult] = useState(null);
  const [file, setFile] = useState(null);
  const [containerField, setContainerField] = useState('');

  // Load records when layout changes
  useEffect(() => {
    if (layout) {
      fetchRecords();
    }
  }, [layout]);

  // Fetch records from the selected layout
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await listRecords(layout);
      setRecords(result.response.data || []);
    } catch (err) {
      setError(`Error fetching records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch a specific record by ID
  const fetchRecord = async () => {
    if (!recordId) {
      setError('Please enter a record ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getRecord(layout, recordId);
      setCurrentRecord(result.response.data[0] || null);
      
      // Update form data with the record's field data
      if (result.response.data[0]) {
        setFormData(result.response.data[0].fieldData || {});
      }
    } catch (err) {
      setError(`Error fetching record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create a new record
  const handleCreateRecord = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await createRecord(layout, formData);
      
      if (result.response && result.response.recordId) {
        setRecordId(result.response.recordId);
        await fetchRecords();
        setError(null);
      } else {
        setError('Failed to create record');
      }
    } catch (err) {
      setError(`Error creating record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update an existing record
  const handleUpdateRecord = async () => {
    if (!recordId) {
      setError('Please enter a record ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await updateRecord(layout, recordId, formData);
      await fetchRecords();
      await fetchRecord();
    } catch (err) {
      setError(`Error updating record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete a record
  const handleDeleteRecord = async () => {
    if (!recordId) {
      setError('Please enter a record ID');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await deleteRecord(layout, recordId);
      setCurrentRecord(null);
      setFormData({});
      setRecordId('');
      await fetchRecords();
    } catch (err) {
      setError(`Error deleting record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Execute a FileMaker script
  const handleExecuteScript = async () => {
    if (!scriptName) {
      setError('Please enter a script name');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await executeScript(layout, scriptName, scriptParam);
      setScriptResult(result);
    } catch (err) {
      setError(`Error executing script: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Upload a file to a container field
  const handleUploadContainer = async () => {
    if (!recordId) {
      setError('Please enter a record ID');
      return;
    }
    
    if (!containerField) {
      setError('Please enter a container field name');
      return;
    }
    
    if (!file) {
      setError('Please select a file');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await uploadContainer(layout, recordId, containerField, file);
      await fetchRecord();
    } catch (err) {
      setError(`Error uploading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download a file from a container field
  const handleDownloadContainer = async () => {
    if (!recordId) {
      setError('Please enter a record ID');
      return;
    }
    
    if (!containerField) {
      setError('Please enter a container field name');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const blob = await downloadContainer(layout, recordId, containerField);
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${layout}_${recordId}_${containerField}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error downloading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle file input changes
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">FileMaker API Example</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Layout Selection */}
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Layout:</label>
        <input
          type="text"
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
        >
          {loading ? 'Loading...' : 'Fetch Records'}
        </button>
      </div>
      
      {/* Records List */}
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Records</h2>
        {records.length === 0 ? (
          <p>No records found</p>
        ) : (
          <ul className="border rounded divide-y">
            {records.map((record) => (
              <li
                key={record.recordId}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setRecordId(record.recordId);
                  fetchRecord();
                }}
              >
                {record.recordId} - {JSON.stringify(record.fieldData).substring(0, 50)}...
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Record Operations */}
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Record Operations</h2>
        
        <div className="mb-2">
          <label className="block text-gray-700 mb-2">Record ID:</label>
          <input
            type="text"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
          <button
            onClick={fetchRecord}
            disabled={loading || !recordId}
            className="bg-blue-500 text-white px-4 py-2 rounded mt-2 mr-2"
          >
            Fetch Record
          </button>
          <button
            onClick={handleDeleteRecord}
            disabled={loading || !recordId}
            className="bg-red-500 text-white px-4 py-2 rounded mt-2"
          >
            Delete Record
          </button>
        </div>
        
        {/* Form for creating/updating records */}
        <div className="border rounded p-4 mb-4">
          <h3 className="text-lg font-bold mb-2">Record Data</h3>
          
          {Object.entries(formData).map(([field, value]) => (
            <div key={field} className="mb-2">
              <label className="block text-gray-700 mb-1">{field}:</label>
              <input
                type="text"
                name={field}
                value={value || ''}
                onChange={handleInputChange}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          ))}
          
          {/* Add new field */}
          <div className="mb-2">
            <button
              onClick={() => {
                const fieldName = prompt('Enter field name:');
                if (fieldName) {
                  setFormData(prev => ({ ...prev, [fieldName]: '' }));
                }
              }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded mt-2"
            >
              Add Field
            </button>
          </div>
          
          <div className="flex mt-4">
            <button
              onClick={handleCreateRecord}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded mr-2"
            >
              Create Record
            </button>
            <button
              onClick={handleUpdateRecord}
              disabled={loading || !recordId}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Update Record
            </button>
          </div>
        </div>
      </div>
      
      {/* Script Execution */}
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Script Execution</h2>
        
        <div className="mb-2">
          <label className="block text-gray-700 mb-1">Script Name:</label>
          <input
            type="text"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        
        <div className="mb-2">
          <label className="block text-gray-700 mb-1">Script Parameter:</label>
          <input
            type="text"
            value={scriptParam}
            onChange={(e) => setScriptParam(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        
        <button
          onClick={handleExecuteScript}
          disabled={loading || !scriptName}
          className="bg-purple-500 text-white px-4 py-2 rounded mt-2"
        >
          Execute Script
        </button>
        
        {scriptResult && (
          <div className="mt-2">
            <h3 className="text-lg font-bold mb-1">Script Result:</h3>
            <pre className="bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(scriptResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Container Operations */}
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Container Operations</h2>
        
        <div className="mb-2">
          <label className="block text-gray-700 mb-1">Container Field:</label>
          <input
            type="text"
            value={containerField}
            onChange={(e) => setContainerField(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        
        <div className="mb-2">
          <label className="block text-gray-700 mb-1">File:</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        
        <div className="flex mt-4">
          <button
            onClick={handleUploadContainer}
            disabled={loading || !recordId || !containerField || !file}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            Upload File
          </button>
          <button
            onClick={handleDownloadContainer}
            disabled={loading || !recordId || !containerField}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Download File
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileMakerExample;