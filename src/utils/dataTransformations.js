/**
 * Flattens a nested JSON structure into CSV format with a cartesian product of related records
 * @param {Object} jsonData - The JSON data containing response.data structure
 * @returns {string} CSV formatted string
 */
function flattenToCSV(jsonData) {
    // Validate input structure
    if (!jsonData?.response?.data || !Array.isArray(jsonData.response.data)) {
        throw new Error('Invalid input data structure');
    }

    /**
     * Safely formats a field value for CSV
     * - Trims whitespace
     * - Handles null/undefined
     * - Escapes quotes
     * - Ensures proper quoting for values containing commas
     */
    const formatField = (value) => {
        if (value === null || value === undefined) return '""';
        // Trim whitespace and handle empty strings
        const trimmed = String(value).trim();
        if (trimmed === '') return '""';
        // Double up any quotes in the content and wrap in quotes
        return `"${trimmed.replace(/"/g, '""')}"`;
    };

    const data = jsonData.response.data;
    
    // Define CSV headers
    const headerFields = [
        'ItemID',
        'LongDesc',
        'ShortDesc',
        'BIN_ID',
        'BIN_Max',
        'BIN_Min',
        'BIN_Qty',
        'BIN_Zone',
        'Zone_Description',
        'VendID',
        'Vendor_PartNo'
    ];
    
    // Create properly formatted header row with comma separation
    const headers = headerFields.map(formatField).join(',');

    // Process each record
    const rows = data.flatMap(record => {
        const fieldData = record.fieldData || {};
        const bins = record.portalData?.StgItem_BINs || [];
        const vendors = record.portalData?.Vendor_StgItem || [];

        // Create cartesian product of bins and vendors
        const flattenedRows = [];
        for (const bin of bins) {
            for (const vendor of vendors) {
                // Format each field and ensure comma separation
                const fields = [
                    fieldData.ItemID,
                    fieldData.LongDesc,
                    fieldData.ShortDesc,
                    bin['StgItem_BINs::BIN_ID'],
                    bin['StgItem_BINs::BIN_Max'],
                    bin['StgItem_BINs::BIN_Min'],
                    bin['StgItem_BINs::BIN_Qty'],
                    bin['StgItem_BINs::BIN_Zone'],
                    bin['StgItem_BINs::Zone_Description'],
                    vendor['Vendor_StgItem::VendID'],
                    vendor['Vendor_StgItem::Vendor PartNo']
                ].map(formatField);

                // Join with explicit commas
                const row = fields.join(',');
                flattenedRows.push(row);
            }
        }
        return flattenedRows;
    });

    // Combine headers and rows with newlines
    const csv = [headers, ...rows].join('\n');
    
    // Return to FileMaker using the correct script name
    if (typeof FileMaker !== 'undefined') {
        FileMaker.PerformScript('js * callback', csv);
    }
    
    return csv;
}

module.exports = { flattenToCSV };
