import React, { useState, useEffect } from 'react';
import { 
  getSupabaseClient, 
  getProjectId, 
  isSupabaseConfigured 
} from '../../services/supabaseService';

/**
 * Example component demonstrating Supabase service usage
 * This component shows how to use the Supabase service to connect to the correct project
 * and perform basic operations.
 */
const SupabaseExample = () => {
  const [projectInfo, setProjectInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [availableTables, setAvailableTables] = useState([]);

  // Fetch project information on component mount
  useEffect(() => {
    async function fetchProjectInfo() {
      try {
        setLoading(true);
        
        // Check if Supabase is configured
        const configured = isSupabaseConfigured();
        if (!configured) {
          throw new Error('Supabase is not properly configured. Check your environment variables.');
        }
        
        // Get project ID
        const projectId = getProjectId();
        
        // Get Supabase client
        const supabase = getSupabaseClient();
        
        // Fetch available tables
        const { data: tables, error: tablesError } = await supabase
          .from('_schema')
          .select('*');
          
        if (tablesError) throw tablesError;
        
        // Extract table names
        const tableNames = tables
          .filter(item => item.type === 'table' && !item.name.startsWith('_'))
          .map(item => item.name);
          
        setAvailableTables(tableNames);
        
        // Set project info
        setProjectInfo({
          projectId,
          tableCount: tableNames.length
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching project info:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProjectInfo();
  }, []);
  
  // Fetch data from selected table
  const fetchTableData = async (tableName) => {
    if (!tableName) return;
    
    try {
      setLoading(true);
      
      const supabase = getSupabaseClient();
      const { data, error: queryError } = await supabase
        .from(tableName)
        .select('*')
        .limit(10);
        
      if (queryError) throw queryError;
      
      setTableData(data || []);
      setError(null);
    } catch (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      setError(err.message);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle table selection change
  const handleTableChange = (e) => {
    const tableName = e.target.value;
    setSelectedTable(tableName);
    if (tableName) {
      fetchTableData(tableName);
    } else {
      setTableData([]);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Supabase Connection Example</h2>
      
      {loading && <p className="text-gray-600">Loading...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {projectInfo && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Project Information</h3>
          <p><strong>Project ID:</strong> {projectInfo.projectId}</p>
          <p><strong>Available Tables:</strong> {projectInfo.tableCount}</p>
        </div>
      )}
      
      {availableTables.length > 0 && (
        <div className="mb-4">
          <label htmlFor="tableSelect" className="block text-sm font-medium text-gray-700 mb-1">
            Select a table to view data:
          </label>
          <select
            id="tableSelect"
            value={selectedTable}
            onChange={handleTableChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">-- Select a table --</option>
            {availableTables.map(table => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </div>
      )}
      
      {selectedTable && tableData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Data from {selectedTable}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(tableData[0]).map(key => (
                    <th 
                      key={key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Object.values(row).map((value, valueIndex) => (
                      <td 
                        key={valueIndex}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {selectedTable && tableData.length === 0 && !loading && (
        <p className="text-gray-600">No data found in the selected table.</p>
      )}
    </div>
  );
};

export default SupabaseExample;