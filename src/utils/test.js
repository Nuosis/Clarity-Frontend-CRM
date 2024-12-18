console.log('Test script starting...');

try {
    const transformModule = require('./dataTransformations.js');
    console.log('Module loaded:', Object.keys(transformModule));
    
    // Test with test.json
    const testData = require('../examples/test.json');
    
    // Analyze input data
    console.log('\nInput Data Analysis:');
    testData.response.data
        .filter(d => Object.keys(d).length > 0)
        .forEach((record, index) => {
            console.log(`\nRecord ${index + 1}:`);
            console.log('ItemID:', record.fieldData?.ItemID);
            console.log('LongDesc:', record.fieldData?.LongDesc);
            console.log('ShortDesc:', record.fieldData?.ShortDesc);
            if (record.portalData?.StgItem_BINs?.length) {
                console.log('Bins:', record.portalData.StgItem_BINs.map(bin => ({
                    id: bin['StgItem_BINs::BIN_ID'],
                    qty: bin['StgItem_BINs::BIN_Qty']
                })));
            } else {
                console.log('Bins: []');
            }
            if (record.portalData?.Vendor_StgItem?.length) {
                console.log('Vendors:', record.portalData.Vendor_StgItem.map(vendor => ({
                    id: vendor['Vendor_StgItem::VendID'],
                    partNo: vendor['Vendor_StgItem::Vendor PartNo']
                })));
            } else {
                console.log('Vendors: []');
            }
        });
    
    // Generate CSV
    const result = transformModule.flattenToCSV(testData);
    const lines = result.split('\n');
    
    console.log('\nOutput Analysis:');
    console.log('Total rows (including header):', lines.length);
    console.log('Data rows:', lines.length - 1);
    
    // Parse CSV line considering quotes
    function parseCSVLine(line) {
        const fields = [];
        let field = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    field += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                fields.push(field);
                field = '';
            } else {
                field += char;
            }
        }
        fields.push(field); // Add the last field
        
        // Clean up quotes
        return fields.map(f => {
            f = f.trim();
            if (f.startsWith('"') && f.endsWith('"')) {
                f = f.slice(1, -1);
            }
            return f;
        });
    }
    
    // Print headers
    console.log('\nHeaders:');
    const headers = parseCSVLine(lines[0]);
    headers.forEach((h, i) => console.log(`${i + 1}. ${h}`));
    
    // Analyze each data row
    console.log('\nData Rows:');
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        console.log(`\nRow ${i}:`);
        fields.forEach((field, index) => {
            if (field !== '') {
                console.log(`${headers[index]}: "${field}"`);
            }
        });
    }
    
    // Print raw CSV for verification
    console.log('\nRaw CSV output:');
    lines.forEach((line, i) => console.log(`${i === 0 ? 'Header' : `Row ${i}`}: ${line}`));
    
} catch (error) {
    console.error('Error occurred:', error);
    console.error(error.stack);
}
