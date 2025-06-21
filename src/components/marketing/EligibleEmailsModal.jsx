import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal component for displaying eligible emails and CSV upload functionality
 */
function EligibleEmailsModal({ isOpen, onClose, eligibleCustomers, onAddCustomRecipients, darkMode }) {
    const [csvFile, setCsvFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = useCallback((event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            setCsvFile(file);
            setError(null);
        } else {
            setError('Please select a valid CSV file');
            setCsvFile(null);
        }
    }, []);

    const processCsvFile = useCallback(async () => {
        if (!csvFile) return;

        setIsProcessing(true);
        setError(null);

        try {
            const text = await csvFile.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('CSV file is empty');
            }

            // Parse CSV - expect headers: email, name, customer_name (optional)
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const emailIndex = headers.findIndex(h => h.includes('email'));
            const nameIndex = headers.findIndex(h => h.includes('name') && !h.includes('customer'));
            const customerNameIndex = headers.findIndex(h => h.includes('customer') && h.includes('name'));

            if (emailIndex === -1) {
                throw new Error('CSV must contain an "email" column');
            }

            const recipients = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                
                if (values[emailIndex] && values[emailIndex].includes('@')) {
                    const recipient = {
                        email: values[emailIndex],
                        name: nameIndex !== -1 ? values[nameIndex] : values[emailIndex].split('@')[0],
                        customer_name: customerNameIndex !== -1 ? values[customerNameIndex] : 
                                     (nameIndex !== -1 ? values[nameIndex].split(' ')[0] : values[emailIndex].split('@')[0])
                    };
                    recipients.push(recipient);
                }
            }

            if (recipients.length === 0) {
                throw new Error('No valid email addresses found in CSV');
            }

            setCsvData(recipients);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    }, [csvFile]);

    const handleAddRecipients = useCallback(() => {
        if (csvData.length > 0) {
            onAddCustomRecipients(csvData);
            setCsvData([]);
            setCsvFile(null);
            onClose();
        }
    }, [csvData, onAddCustomRecipients, onClose]);

    const handleClose = useCallback(() => {
        setCsvFile(null);
        setCsvData([]);
        setError(null);
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
                max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden rounded-lg shadow-xl
                ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
            `}>
                {/* Header */}
                <div className={`
                    px-6 py-4 border-b flex items-center justify-between
                    ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                `}>
                    <h2 className="text-xl font-semibold">Eligible Email Recipients</h2>
                    <button
                        onClick={handleClose}
                        className={`
                            p-2 rounded-md
                            ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                        `}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
                    {/* Current Eligible Customers */}
                    <div className="mb-8">
                        <h3 className={`
                            text-lg font-medium mb-4
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            Current Eligible Customers ({eligibleCustomers.length})
                        </h3>
                        
                        <div className={`
                            max-h-60 overflow-y-auto border rounded-lg
                            ${darkMode ? 'border-gray-600' : 'border-gray-300'}
                        `}>
                            <table className="w-full">
                                <thead className={`
                                    sticky top-0
                                    ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}
                                `}>
                                    <tr>
                                        <th className={`
                                            px-4 py-2 text-left text-sm font-medium
                                            ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                        `}>
                                            Name
                                        </th>
                                        <th className={`
                                            px-4 py-2 text-left text-sm font-medium
                                            ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                        `}>
                                            Email
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eligibleCustomers.map((customer, index) => (
                                        <tr key={customer.id || index} className={`
                                            border-t
                                            ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                                        `}>
                                            <td className={`
                                                px-4 py-2 text-sm
                                                ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                            `}>
                                                {customer.Name || customer.name}
                                            </td>
                                            <td className={`
                                                px-4 py-2 text-sm
                                                ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                            `}>
                                                {customer.Email || customer.email}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* CSV Upload Section */}
                    <div className={`
                        p-6 border rounded-lg
                        ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}
                    `}>
                        <h3 className={`
                            text-lg font-medium mb-4
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            Add Custom Recipients via CSV
                        </h3>
                        
                        <div className="mb-4">
                            <p className={`
                                text-sm mb-2
                                ${darkMode ? 'text-gray-300' : 'text-gray-600'}
                            `}>
                                Upload a CSV file with columns: <strong>email</strong>, <strong>name</strong> (optional), <strong>customer_name</strong> (optional)
                            </p>
                            
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className={`
                                    block w-full text-sm border rounded-md px-3 py-2
                                    ${darkMode 
                                        ? 'bg-gray-600 border-gray-500 text-white file:bg-gray-700 file:text-white' 
                                        : 'bg-white border-gray-300 text-gray-900 file:bg-gray-100 file:text-gray-700'}
                                    file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium
                                `}
                            />
                        </div>

                        {csvFile && (
                            <div className="mb-4">
                                <button
                                    onClick={processCsvFile}
                                    disabled={isProcessing}
                                    className={`
                                        px-4 py-2 rounded-md text-sm font-medium
                                        ${isProcessing
                                            ? (darkMode ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                            : (darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')}
                                    `}
                                >
                                    {isProcessing ? 'Processing...' : 'Process CSV File'}
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className={`
                                p-3 rounded-md mb-4
                                ${darkMode ? 'bg-red-900/20 border border-red-700 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}
                            `}>
                                {error}
                            </div>
                        )}

                        {csvData.length > 0 && (
                            <div>
                                <h4 className={`
                                    font-medium mb-2
                                    ${darkMode ? 'text-white' : 'text-gray-900'}
                                `}>
                                    Parsed Recipients ({csvData.length})
                                </h4>
                                
                                <div className={`
                                    max-h-40 overflow-y-auto border rounded-md mb-4
                                    ${darkMode ? 'border-gray-600' : 'border-gray-300'}
                                `}>
                                    <table className="w-full text-sm">
                                        <thead className={`
                                            sticky top-0
                                            ${darkMode ? 'bg-gray-600' : 'bg-gray-100'}
                                        `}>
                                            <tr>
                                                <th className={`
                                                    px-3 py-2 text-left
                                                    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                                `}>
                                                    Email
                                                </th>
                                                <th className={`
                                                    px-3 py-2 text-left
                                                    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                                `}>
                                                    Name
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvData.map((recipient, index) => (
                                                <tr key={index} className={`
                                                    border-t
                                                    ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                                                `}>
                                                    <td className={`
                                                        px-3 py-2
                                                        ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                                    `}>
                                                        {recipient.email}
                                                    </td>
                                                    <td className={`
                                                        px-3 py-2
                                                        ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                                    `}>
                                                        {recipient.name}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <button
                                    onClick={handleAddRecipients}
                                    className={`
                                        px-4 py-2 rounded-md text-sm font-medium
                                        ${darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
                                    `}
                                >
                                    Add {csvData.length} Recipients
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`
                    px-6 py-4 border-t flex justify-end
                    ${darkMode ? 'border-gray-700' : 'border-gray-200'}
                `}>
                    <button
                        onClick={handleClose}
                        className={`
                            px-4 py-2 rounded-md text-sm font-medium
                            ${darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                        `}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

EligibleEmailsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    eligibleCustomers: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        Name: PropTypes.string,
        Email: PropTypes.string,
        name: PropTypes.string,
        email: PropTypes.string
    })).isRequired,
    onAddCustomRecipients: PropTypes.func.isRequired,
    darkMode: PropTypes.bool.isRequired
};

export default React.memo(EligibleEmailsModal);