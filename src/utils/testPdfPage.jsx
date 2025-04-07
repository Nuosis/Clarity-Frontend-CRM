import React, { useState } from 'react';
import TestPdfButton from './testPdfButton';

/**
 * A simple page component to test PDF generation
 */
function TestPdfPage() {
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  // Function to test if jsPDF and autoTable are working correctly
  const checkJsPdfAutoTable = () => {
    try {
      setError(null);
      setTestResult(null);
      
      // Import modules dynamically to check if they load correctly
      Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]).then(([jsPDF, autoTable]) => {
        // Check if modules are loaded correctly
        const results = {
          jsPDF: {
            loaded: !!jsPDF,
            default: !!jsPDF.default,
            jsPDF: !!jsPDF.jsPDF,
            version: jsPDF.version || 'unknown'
          },
          autoTable: {
            loaded: !!autoTable,
            default: !!autoTable.default,
            version: autoTable.version || 'unknown'
          }
        };
        
        // Create a test instance
        const doc = new jsPDF.jsPDF();
        
        // Check if autoTable is available on the instance
        results.autoTableOnInstance = typeof doc.autoTable === 'function';
        
        // Check if autoTable is available on the prototype
        results.autoTableOnPrototype = typeof jsPDF.jsPDF.prototype.autoTable === 'function';
        
        setTestResult(results);
      }).catch(err => {
        setError(`Error loading modules: ${err.message}`);
      });
    } catch (err) {
      setError(`Error in check: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PDF Generation Test Page</h1>
      
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Test PDF Generation</h2>
        <p className="mb-4">
          Click the button below to test PDF generation with jsPDF and autoTable.
          Check the console for detailed logs.
        </p>
        <TestPdfButton />
      </div>
      
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Check jsPDF and autoTable</h2>
        <p className="mb-4">
          Click the button below to check if jsPDF and autoTable are loaded correctly.
        </p>
        <button
          onClick={checkJsPdfAutoTable}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Check Modules
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {testResult && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <pre className="text-sm overflow-auto p-2 bg-gray-100 rounded">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Check the console for detailed error messages</li>
          <li>Verify that jsPDF and jspdf-autotable are installed correctly</li>
          <li>Make sure the import statements are correct</li>
          <li>Check if autoTable is properly extending the jsPDF prototype</li>
        </ul>
      </div>
    </div>
  );
}

export default TestPdfPage;