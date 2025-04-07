import React from 'react';
import { testPdfGeneration, testPdfDownload } from './testPdf';

/**
 * A simple button component to test PDF generation and download
 */
function TestPdfButton() {
  const handleTestPdf = () => {
    console.log('Test PDF button clicked');
    try {
      // Test PDF generation
      const pdf = testPdfGeneration();
      console.log('PDF generated successfully:', pdf);
      
      // Download the PDF
      const blob = pdf.blob;
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-pdf.pdf';
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log('PDF download initiated');
    } catch (error) {
      console.error('Error in PDF test:', error);
      alert(`PDF Test Error: ${error.message}`);
    }
  };

  return (
    <button
      onClick={handleTestPdf}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
    >
      Test PDF Generation
    </button>
  );
}

export default TestPdfButton;