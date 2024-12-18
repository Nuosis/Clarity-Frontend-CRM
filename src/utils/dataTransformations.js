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
    
    // Create header row with proper formatting
    const headers = headerFields.map(formatField).join(',');

    // Process each record
    const rows = jsonData.response.data
        // Filter out empty records
        .filter(record => Object.keys(record).length > 0)
        .flatMap(record => {
            const fieldData = record.fieldData || {};
            const bins = record.portalData?.StgItem_BINs || [];
            const vendors = record.portalData?.Vendor_StgItem || [];

            // If no bins and vendors exist, create one row per vendor with empty bin fields
            if (bins.length === 0 && vendors.length > 0) {
                return vendors.map(vendor => {
                    const fields = [
                        fieldData.ItemID || '',
                        fieldData.LongDesc || '',
                        fieldData.ShortDesc || '',
                        '', // BIN_ID
                        '', // BIN_Max
                        '', // BIN_Min
                        '', // BIN_Qty
                        '', // BIN_Zone
                        '', // Zone_Description
                        (vendor['Vendor_StgItem::VendID'] || '').trim(),
                        (vendor['Vendor_StgItem::Vendor PartNo'] || '').trim()
                    ];
                    return fields.map(formatField).join(',');
                });
            }

            // If bins exist but no vendors, create one row per bin with empty vendor fields
            if (bins.length > 0 && vendors.length === 0) {
                return bins.map(bin => {
                    const fields = [
                        fieldData.ItemID || '',
                        fieldData.LongDesc || '',
                        fieldData.ShortDesc || '',
                        bin['StgItem_BINs::BIN_ID'] || '',
                        bin['StgItem_BINs::BIN_Max'] || '',
                        bin['StgItem_BINs::BIN_Min'] || '',
                        String(bin['StgItem_BINs::BIN_Qty'] || ''),
                        bin['StgItem_BINs::BIN_Zone'] || '',
                        bin['StgItem_BINs::Zone_Description'] || '',
                        '', // VendID
                        ''  // Vendor_PartNo
                    ];
                    return fields.map(formatField).join(',');
                });
            }

            // If both bins and vendors exist, create cartesian product
            if (bins.length > 0 && vendors.length > 0) {
                return bins.flatMap(bin => 
                    vendors.map(vendor => {
                        const fields = [
                            fieldData.ItemID || '',
                            fieldData.LongDesc || '',
                            fieldData.ShortDesc || '',
                            bin['StgItem_BINs::BIN_ID'] || '',
                            bin['StgItem_BINs::BIN_Max'] || '',
                            bin['StgItem_BINs::BIN_Min'] || '',
                            String(bin['StgItem_BINs::BIN_Qty'] || ''),
                            bin['StgItem_BINs::BIN_Zone'] || '',
                            bin['StgItem_BINs::Zone_Description'] || '',
                            (vendor['Vendor_StgItem::VendID'] || '').trim(),
                            (vendor['Vendor_StgItem::Vendor PartNo'] || '').trim()
                        ];
                        return fields.map(formatField).join(',');
                    })
                );
            }

            // If no bins and no vendors, create one row with empty fields
            const fields = [
                fieldData.ItemID || '',
                fieldData.LongDesc || '',
                fieldData.ShortDesc || '',
                '', // BIN_ID
                '', // BIN_Max
                '', // BIN_Min
                '', // BIN_Qty
                '', // BIN_Zone
                '', // Zone_Description
                '', // VendID
                ''  // Vendor_PartNo
            ];
            return [fields.map(formatField).join(',')];
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
