console.log('Test script starting...');

try {
    const transformModule = require('./dataTransformations.js');
    console.log('Module loaded:', Object.keys(transformModule));
    
    const testData = require('../examples/data.json');
    console.log('Test data loaded:', testData.response.data.length, 'records');
    
    const result = transformModule.flattenToCSV(testData);
    const lines = result.split('\n');
    
    console.log('\nCSV Generation Result:');
    
    // Test CSV parsing
    console.log('\nParsing first row fields:');
    const firstRow = lines[1];
    let field = '';
    let inQuotes = false;
    let fields = [];
    
    for (let i = 0; i < firstRow.length; i++) {
        const char = firstRow[i];
        if (char === '"') {
            if (inQuotes && firstRow[i + 1] === '"') {
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
    if (field) fields.push(field);
    
    console.log('\nField count:', fields.length);
    console.log('\nFields:');
    fields.forEach((f, i) => {
        console.log(`${i + 1}. [${f}]`);
    });
    
    console.log('\nRaw first row for verification:');
    console.log(firstRow);
    
    console.log('\nTotal rows:', lines.length);
    
} catch (error) {
    console.error('Error occurred:', error);
}
