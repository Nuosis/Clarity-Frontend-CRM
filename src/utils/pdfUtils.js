/**
 * PDF Utilities Module
 * 
 * This module provides utility functions for working with PDF generation
 * using jsPDF and jspdf-autotable.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Ensures that the jsPDF prototype has the autoTable method
 * This is necessary because the way jspdf-autotable extends jsPDF
 * can be inconsistent across different environments (browser vs Node.js vs Jest)
 * 
 * @returns {boolean} True if autoTable was applied, false if it was already available
 */
export function ensureAutoTableAvailable() {
  if (typeof jsPDF.prototype.autoTable !== 'function') {
    console.log('Applying autoTable to jsPDF prototype in pdfUtils');
    jsPDF.prototype.autoTable = function(...args) {
      return autoTable(this, ...args);
    };
    return true;
  }
  return false;
}

/**
 * Creates a new jsPDF instance with autoTable support
 * 
 * @param {Object} options - jsPDF initialization options
 * @param {string} options.orientation - Page orientation: 'portrait' or 'landscape'
 * @param {string} options.unit - Measurement unit: 'mm', 'cm', 'in', 'pt'
 * @param {string|Array} options.format - Page format: 'a4', 'letter', etc. or [width, height]
 * @returns {Object} jsPDF instance with autoTable support
 */
export function createPdf(options = {}) {
  // Ensure autoTable is available
  ensureAutoTableAvailable();
  
  // Create new jsPDF instance with default options if not provided
  const defaultOptions = {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  };
  
  return new jsPDF({...defaultOptions, ...options});
}

/**
 * Helper function to download a PDF
 * 
 * @param {Object} pdfData - PDF data object
 * @param {Blob} pdfData.blob - PDF as a blob
 * @param {string} pdfData.fileName - Filename for the PDF
 * @returns {Promise} Promise that resolves when download is complete
 */
export function downloadPdf(pdfData) {
  return new Promise((resolve, reject) => {
    try {
      const blob = pdfData.blob;
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfData.fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve(true);
      }, 100);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      reject(error);
    }
  });
}

// Initialize by ensuring autoTable is available
ensureAutoTableAvailable();

export default {
  ensureAutoTableAvailable,
  createPdf,
  downloadPdf
};