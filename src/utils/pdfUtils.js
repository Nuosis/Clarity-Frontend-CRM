/**
 * PDF Utilities Module
 *
 * This module provides utility functions for working with PDF generation
 * using pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

/**
 * Creates a new PDF document with default settings
 *
 * @param {Object} options - PDF initialization options
 * @param {string} options.orientation - Page orientation: 'portrait' or 'landscape'
 * @param {string} options.format - Page format: 'a4', 'letter', etc.
 * @returns {Promise<Object>} PDF document object with helper methods
 */
export async function createPdf(options = {}) {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Set default options
  const defaultOptions = {
    orientation: 'portrait',
    format: 'a4'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Set up page size based on format and orientation
  let pageSize = PageSizes.A4;
  if (mergedOptions.format === 'letter') {
    pageSize = PageSizes.Letter;
  }
  
  // Adjust for landscape orientation
  if (mergedOptions.orientation === 'landscape') {
    pageSize = [pageSize[1], pageSize[0]]; // Swap width and height
  }
  
  // Add the first page
  pdfDoc.addPage(pageSize);
  
  // Embed standard fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Return document with helper methods
  return {
    pdfDoc,
    pageSize,
    fonts: {
      helvetica: helveticaFont,
      helveticaBold: helveticaBoldFont
    },
    currentPage: 0,
    
    // Helper method to add a new page
    addPage() {
      pdfDoc.addPage(pageSize);
      this.currentPage = pdfDoc.getPageCount() - 1;
      return this.currentPage;
    },
    
    // Helper method to get the current page
    getPage(pageIndex = null) {
      const index = pageIndex !== null ? pageIndex : this.currentPage;
      return pdfDoc.getPage(index);
    },
    
    // Helper method to draw text
    drawText(text, x, y, options = {}) {
      const page = this.getPage();
      const {
        font = 'helvetica',
        size = 12,
        color = rgb(0, 0, 0),
        align = 'left'
      } = options;
      
      const fontObj = this.fonts[font] || this.fonts.helvetica;
      
      // Handle text alignment
      let xPos = x;
      if (align === 'center') {
        const textWidth = fontObj.widthOfTextAtSize(text, size);
        xPos = x - (textWidth / 2);
      } else if (align === 'right') {
        const textWidth = fontObj.widthOfTextAtSize(text, size);
        xPos = x - textWidth;
      }
      
      page.drawText(text, {
        x: xPos,
        y: y,
        size: size,
        font: fontObj,
        color: color
      });
    },
    
    // Helper method to draw a line
    drawLine(x1, y1, x2, y2, options = {}) {
      const page = this.getPage();
      const {
        thickness = 1,
        color = rgb(0, 0, 0)
      } = options;
      
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness,
        color
      });
    },
    
    // Helper method to draw a rectangle
    drawRectangle(x, y, width, height, options = {}) {
      const page = this.getPage();
      const {
        borderColor = rgb(0, 0, 0),
        borderWidth = 1,
        fillColor = null
      } = options;
      
      if (fillColor) {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: fillColor
        });
      }
      
      if (borderWidth > 0) {
        // Draw border as four lines
        page.drawLine({
          start: { x, y },
          end: { x: x + width, y },
          thickness: borderWidth,
          color: borderColor
        });
        
        page.drawLine({
          start: { x: x + width, y },
          end: { x: x + width, y: y + height },
          thickness: borderWidth,
          color: borderColor
        });
        
        page.drawLine({
          start: { x: x + width, y: y + height },
          end: { x, y: y + height },
          thickness: borderWidth,
          color: borderColor
        });
        
        page.drawLine({
          start: { x, y: y + height },
          end: { x, y },
          thickness: borderWidth,
          color: borderColor
        });
      }
    },
    
    // Helper method to save the PDF
    async save(fileName = 'document.pdf') {
      const pdfBytes = await pdfDoc.save();
      return {
        blob: new Blob([pdfBytes], { type: 'application/pdf' }),
        buffer: pdfBytes.buffer,
        fileName: fileName,
        bytes: pdfBytes
      };
    }
  };
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
      console.log('Starting PDF download process', {
        hasBlob: !!pdfData.blob,
        fileName: pdfData.fileName,
        blobType: pdfData.blob?.type
      });
      
      // Ensure we have a proper blob with the correct MIME type
      let blob = pdfData.blob;
      
      // If the blob doesn't have the correct type, create a new one
      if (!blob.type || blob.type !== 'application/pdf') {
        console.log('Creating new blob with correct MIME type');
        blob = new Blob([blob], { type: 'application/pdf' });
      }
      
      // Ensure filename has .pdf extension
      const fileName = pdfData.fileName || 'document.pdf';
      const fileNameWithExt = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      console.log(`Using filename: ${fileNameWithExt}`);
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      console.log('Created object URL for blob');
      
      // Create a link with the URL
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNameWithExt;
      link.setAttribute('type', 'application/pdf');
      // Set target to _self to prevent opening in new tab
      link.setAttribute('target', '_self');
      // Add additional attributes to force download
      link.setAttribute('rel', 'noopener noreferrer');
      
      // In test environments, just simulate the click without DOM manipulation
      if (process.env.NODE_ENV === 'test') {
        // For test environments, just simulate the click
        link.click();
        URL.revokeObjectURL(url);
        resolve(true);
      } else {
        // For browser environments, use proper DOM manipulation
        document.body.appendChild(link);
        
        // Use a more explicit approach to trigger the download
        // Create and dispatch a MouseEvent instead of using click()
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: false
        });
        link.dispatchEvent(clickEvent);
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
          document.body.removeChild(link);
          console.log('Download process completed successfully');
          resolve(true);
        }, 100);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      reject(error);
    }
  });
}

/**
 * Helper function to create a simple table in a PDF
 *
 * @param {Object} pdfDoc - PDF document object from createPdf
 * @param {Array} headers - Array of header strings
 * @param {Array} rows - Array of row arrays
 * @param {Object} options - Table options
 * @returns {Object} Updated PDF document
 */
export async function drawTable(pdfDoc, headers, rows, options = {}) {
  const {
    x = 50,
    y = 700,
    width = 500,
    rowHeight = 30,
    headerColor = rgb(0.26, 0.54, 0.79), // #428bca
    headerTextColor = rgb(1, 1, 1),
    alternateRowColor = rgb(0.96, 0.96, 0.96), // #f5f5f5
    borderColor = rgb(0.8, 0.8, 0.8),
    fontSize = 10,
    headerFontSize = 11,
    columnWidths = []
  } = options;
  
  // Calculate column widths if not provided
  let colWidths = columnWidths.length > 0 ? columnWidths : [];
  if (colWidths.length === 0) {
    const availableWidth = width;
    const colCount = headers.length;
    
    // Default to equal widths
    colWidths = Array(colCount).fill(availableWidth / colCount);
  }
  
  // Draw header row
  let currentY = y;
  let currentX = x;
  
  // Draw header background
  pdfDoc.drawRectangle(x, currentY - rowHeight, width, rowHeight, {
    fillColor: headerColor
  });
  
  // Draw header text
  for (let i = 0; i < headers.length; i++) {
    const colWidth = colWidths[i];
    const textX = currentX + (colWidth / 2);
    
    pdfDoc.drawText(headers[i], textX, currentY - (rowHeight / 2) - (headerFontSize / 2), {
      font: 'helveticaBold',
      size: headerFontSize,
      color: headerTextColor,
      align: 'center'
    });
    
    currentX += colWidth;
  }
  
  currentY -= rowHeight;
  
  // Draw data rows
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Check if we need to add a new page
    if (currentY - rowHeight < 50) {
      pdfDoc.addPage();
      currentY = pdfDoc.pageSize[1] - 50; // Reset Y position on new page
    }
    
    // Draw row background (alternate colors)
    if (rowIndex % 2 === 1) {
      pdfDoc.drawRectangle(x, currentY - rowHeight, width, rowHeight, {
        fillColor: alternateRowColor
      });
    }
    
    // Draw row data
    currentX = x;
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const colWidth = colWidths[colIndex];
      const cellData = row[colIndex] || '';
      const textX = currentX + 5; // Left padding
      
      // Determine text alignment based on data type
      let align = 'left';
      if (typeof cellData === 'number') {
        align = 'right';
      }
      
      const textOptions = {
        font: 'helvetica',
        size: fontSize,
        align
      };
      
      if (align === 'right') {
        pdfDoc.drawText(cellData.toString(), currentX + colWidth - 5, currentY - (rowHeight / 2) - (fontSize / 2), textOptions);
      } else {
        pdfDoc.drawText(cellData.toString(), textX, currentY - (rowHeight / 2) - (fontSize / 2), textOptions);
      }
      
      currentX += colWidth;
    }
    
    // Draw horizontal line
    pdfDoc.drawLine(x, currentY, x + width, currentY, {
      thickness: 0.5,
      color: borderColor
    });
    
    currentY -= rowHeight;
  }
  
  // Draw final horizontal line
  pdfDoc.drawLine(x, currentY, x + width, currentY, {
    thickness: 0.5,
    color: borderColor
  });
  
  // Draw vertical lines
  currentX = x;
  for (let i = 0; i <= colWidths.length; i++) {
    pdfDoc.drawLine(currentX, y, currentX, currentY, {
      thickness: 0.5,
      color: borderColor
    });
    
    if (i < colWidths.length) {
      currentX += colWidths[i];
    }
  }
  
  return pdfDoc;
}

export default {
  createPdf,
  downloadPdf,
  drawTable
};