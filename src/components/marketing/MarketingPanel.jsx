import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { sendInformationSessionEmails, sendCustomListInformationSessionEmails, sendTestInformationSessionEmail } from '../../api/marketing';
import EligibleEmailsModal from './EligibleEmailsModal';

/**
 * Marketing Panel Component
 * Handles bulk email campaigns for information sessions
 */
function MarketingPanel({ customers, darkMode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isTestLoading, setIsTestLoading] = useState(false);
    const [isCsvLoading, setIsCsvLoading] = useState(false);
    const [campaignResult, setCampaignResult] = useState(null);
    const [error, setError] = useState(null);
    const [showEligibleModal, setShowEligibleModal] = useState(false);
    const [customRecipients, setCustomRecipients] = useState([]);
    const [csvFile, setCsvFile] = useState(null);
    const [csvRecipients, setCsvRecipients] = useState([]);
    const [emailConfig, setEmailConfig] = useState({
        subject: "You're Invited to an Informational Session - Clarity Business Solutions",
        batchSize: 10,
        delayBetweenBatches: 1.0
    });

    // Calculate eligible customers (where f_noCom is not 1 AND has email address) and combine with custom recipients
    const eligibleCustomers = customers.filter(customer =>
        customer.f_noCom !== 1 &&
        customer.Email &&
        customer.Email.trim() !== '' &&
        customer.Email.includes('@')
    );
    const ineligibleCustomers = customers.filter(customer =>
        customer.f_noCom === 1 ||
        !customer.Email ||
        customer.Email.trim() === '' ||
        !customer.Email.includes('@')
    );
    const allRecipients = [...eligibleCustomers, ...customRecipients];

    const handleSendInformationSession = useCallback(async () => {
        if (allRecipients.length === 0) {
            setError('No eligible recipients found. All customers have opted out of communications (f_noCom = 1) and no custom recipients added.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setCampaignResult(null);

        try {
            // Combine customers and custom recipients for sending
            const combinedRecipients = [...customers, ...customRecipients];
            const result = await sendInformationSessionEmails(combinedRecipients, emailConfig);
            setCampaignResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [customers, customRecipients, allRecipients.length, emailConfig]);

    const handleSendTestEmail = useCallback(async () => {
        setIsTestLoading(true);
        setError(null);
        setCampaignResult(null);

        try {
            const result = await sendTestInformationSessionEmail(emailConfig);
            setCampaignResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsTestLoading(false);
        }
    }, [emailConfig]);

    const handleSendCsvList = useCallback(async () => {
        if (!csvFile) {
            setError('Please select a CSV file first.');
            return;
        }

        setIsCsvLoading(true);
        setError(null);
        setCampaignResult(null);

        try {
            const result = await sendCustomListInformationSessionEmails(csvFile, emailConfig);
            setCampaignResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsCsvLoading(false);
        }
    }, [csvFile, emailConfig]);

    const parseCSV = useCallback((csvText) => {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file must contain at least a header row and one data row');
        }

        // Parse header row
        const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
        
        // Find required columns
        const emailIndex = headers.findIndex(h => h === 'email');
        const nameIndex = headers.findIndex(h => h === 'name');
        const companyIndex = headers.findIndex(h => h === 'company');
        const phoneIndex = headers.findIndex(h => h === 'phone');

        if (emailIndex === -1) {
            throw new Error('CSV file must contain an "Email" column');
        }

        // Parse data rows
        const recipients = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
            
            if (values.length < headers.length) {
                continue; // Skip incomplete rows
            }

            const email = values[emailIndex];
            if (!email || !email.includes('@')) {
                continue; // Skip rows with invalid emails
            }

            const recipient = {
                email: email,
                name: nameIndex !== -1 ? values[nameIndex] : email.split('@')[0],
                company: companyIndex !== -1 ? values[companyIndex] : '',
                phone: phoneIndex !== -1 ? values[phoneIndex] : ''
            };

            recipients.push(recipient);
        }

        return recipients;
    }, []);

    const handleCsvFileChange = useCallback(async (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            try {
                setCsvFile(file);
                setError(null);
                
                // Parse CSV file
                const csvText = await file.text();
                const recipients = parseCSV(csvText);
                setCsvRecipients(recipients);
            } catch (err) {
                setError(`CSV parsing error: ${err.message}`);
                setCsvFile(null);
                setCsvRecipients([]);
            }
        } else {
            setError('Please select a valid CSV file.');
            setCsvFile(null);
            setCsvRecipients([]);
        }
    }, [parseCSV]);

    const handleConfigChange = useCallback((field, value) => {
        setEmailConfig(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const resetResults = useCallback(() => {
        setCampaignResult(null);
        setError(null);
    }, []);

    const handleAddCustomRecipients = useCallback((newRecipients) => {
        setCustomRecipients(prev => [...prev, ...newRecipients]);
    }, []);

    const handleShowEligibleModal = useCallback(() => {
        setShowEligibleModal(true);
    }, []);

    const handleCloseEligibleModal = useCallback(() => {
        setShowEligibleModal(false);
    }, []);

    return (
        <div className={`
            p-6 h-full overflow-y-auto
            ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
        `}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className={`
                        text-3xl font-bold mb-2
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        Marketing Center
                    </h1>
                    <p className={`
                        text-lg
                        ${darkMode ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                        Send information session invitations to eligible customers
                    </p>
                </div>

                {/* Customer Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className={`
                        p-4 rounded-lg border
                        ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
                    `}>
                        <h3 className={`
                            text-sm font-medium mb-1
                            ${darkMode ? 'text-gray-400' : 'text-gray-500'}
                        `}>
                            Total Customers
                        </h3>
                        <p className={`
                            text-2xl font-bold
                            ${darkMode ? 'text-white' : 'text-gray-900'}
                        `}>
                            {customers.length}
                        </p>
                    </div>
                    
                    <div
                        className={`
                            p-4 rounded-lg border cursor-pointer transition-colors
                            ${darkMode ? 'bg-green-900/20 border-green-700 hover:bg-green-900/30' : 'bg-green-50 border-green-200 hover:bg-green-100'}
                        `}
                        onClick={handleShowEligibleModal}
                        title="Click to view eligible recipients and add custom ones"
                    >
                        <h3 className={`
                            text-sm font-medium mb-1
                            ${darkMode ? 'text-green-400' : 'text-green-600'}
                        `}>
                            Eligible for Email
                        </h3>
                        <p className={`
                            text-2xl font-bold
                            ${darkMode ? 'text-green-300' : 'text-green-700'}
                        `}>
                            {allRecipients.length}
                        </p>
                        {customRecipients.length > 0 && (
                            <p className={`
                                text-xs mt-1
                                ${darkMode ? 'text-green-400' : 'text-green-600'}
                            `}>
                                (+{customRecipients.length} custom)
                            </p>
                        )}
                    </div>
                    
                    <div className={`
                        p-4 rounded-lg border
                        ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}
                    `}>
                        <h3 className={`
                            text-sm font-medium mb-1
                            ${darkMode ? 'text-red-400' : 'text-red-600'}
                        `}>
                            Opted Out
                        </h3>
                        <p className={`
                            text-2xl font-bold
                            ${darkMode ? 'text-red-300' : 'text-red-700'}
                        `}>
                            {ineligibleCustomers.length}
                        </p>
                    </div>
                </div>

                {/* Email Configuration */}
                <div className={`
                    p-6 rounded-lg border mb-8
                    ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
                `}>
                    <h2 className={`
                        text-xl font-semibold mb-4
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        Email Campaign Configuration
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className={`
                                block text-sm font-medium mb-2
                                ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                            `}>
                                Email Subject
                            </label>
                            <input
                                type="text"
                                value={emailConfig.subject}
                                onChange={(e) => handleConfigChange('subject', e.target.value)}
                                className={`
                                    w-full px-3 py-2 border rounded-md
                                    ${darkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`
                                    block text-sm font-medium mb-2
                                    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                `}>
                                    Batch Size
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={emailConfig.batchSize}
                                    onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value))}
                                    className={`
                                        w-full px-3 py-2 border rounded-md
                                        ${darkMode 
                                            ? 'bg-gray-700 border-gray-600 text-white' 
                                            : 'bg-white border-gray-300 text-gray-900'}
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    `}
                                />
                            </div>
                            
                            <div>
                                <label className={`
                                    block text-sm font-medium mb-2
                                    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                                `}>
                                    Delay Between Batches (seconds)
                                </label>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="10"
                                    step="0.5"
                                    value={emailConfig.delayBetweenBatches}
                                    onChange={(e) => handleConfigChange('delayBetweenBatches', parseFloat(e.target.value))}
                                    className={`
                                        w-full px-3 py-2 border rounded-md
                                        ${darkMode 
                                            ? 'bg-gray-700 border-gray-600 text-white' 
                                            : 'bg-white border-gray-300 text-gray-900'}
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    `}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* CSV Upload Section */}
                <div className={`
                    p-6 rounded-lg border mb-8
                    ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
                `}>
                    <h2 className={`
                        text-xl font-semibold mb-4
                        ${darkMode ? 'text-white' : 'text-gray-900'}
                    `}>
                        Custom CSV List
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className={`
                                block text-sm font-medium mb-2
                                ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                            `}>
                                Upload CSV File
                            </label>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCsvFileChange}
                                className={`
                                    w-full px-3 py-2 border rounded-md
                                    ${darkMode
                                        ? 'bg-gray-700 border-gray-600 text-white file:bg-gray-600 file:text-white file:border-gray-500'
                                        : 'bg-white border-gray-300 text-gray-900 file:bg-gray-50 file:text-gray-700 file:border-gray-300'}
                                    file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium
                                    hover:file:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                            />
                            {csvFile && (
                                <p className={`
                                    text-sm mt-2
                                    ${darkMode ? 'text-green-400' : 'text-green-600'}
                                `}>
                                    Selected: {csvFile.name} ({csvRecipients.length} recipients)
                                </p>
                            )}
                        </div>
                        
                        {csvRecipients.length > 0 ? (
                            <div className={`
                                border rounded-md
                                ${darkMode ? 'border-gray-600' : 'border-gray-300'}
                            `}>
                                <div className={`
                                    px-3 py-2 border-b font-medium text-sm
                                    ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}
                                `}>
                                    CSV Recipients ({csvRecipients.length})
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {csvRecipients.map((recipient, index) => (
                                        <div
                                            key={index}
                                            className={`
                                                px-3 py-2 border-b last:border-b-0 text-sm
                                                ${darkMode ? 'border-gray-600' : 'border-gray-200'}
                                            `}
                                        >
                                            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {recipient.name}
                                            </div>
                                            <div className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {recipient.email}
                                            </div>
                                            {(recipient.company || recipient.phone) && (
                                                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {recipient.company && <span>{recipient.company}</span>}
                                                    {recipient.company && recipient.phone && <span> • </span>}
                                                    {recipient.phone && <span>{recipient.phone}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className={`
                                text-sm p-3 rounded-md
                                ${darkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}
                            `}>
                                <p className="font-medium mb-1">CSV Format Requirements:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Must include columns: Name, Email</li>
                                    <li>Optional columns: Company, Phone</li>
                                    <li>First row should contain column headers</li>
                                    <li>Email addresses must be valid format</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleSendInformationSession}
                            disabled={isLoading || allRecipients.length === 0}
                            className={`
                                flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center
                                ${isLoading || allRecipients.length === 0
                                    ? (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                    : (darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')}
                                transition-colors duration-200
                            `}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending Emails...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Send Information Session Emails ({allRecipients.length} recipients)
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={handleSendCsvList}
                            disabled={isCsvLoading || isLoading || isTestLoading || !csvFile}
                            className={`
                                px-6 py-3 rounded-lg font-medium flex items-center justify-center
                                ${isCsvLoading || isLoading || isTestLoading || !csvFile
                                    ? (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                    : (darkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white')}
                                transition-colors duration-200
                            `}
                        >
                            {isCsvLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Send to CSV List
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={handleSendTestEmail}
                            disabled={isTestLoading || isLoading || isCsvLoading}
                            className={`
                                px-6 py-3 rounded-lg font-medium flex items-center justify-center
                                ${isTestLoading || isLoading || isCsvLoading
                                    ? (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                    : (darkMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white')}
                                transition-colors duration-200
                            `}
                        >
                            {isTestLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending Test...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    Send Test Email
                                </>
                            )}
                        </button>
                    </div>
                    
                    <p className={`
                        text-sm text-center
                        ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                    `}>
                        Test email will be sent only to marcus@claritybusinesssolutions.ca
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className={`
                        p-4 rounded-lg border mb-8
                        ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}
                    `}>
                        <div className="flex items-center">
                            <svg className={`w-5 h-5 mr-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className={`font-medium ${darkMode ? 'text-red-400' : 'text-red-800'}`}>
                                Error
                            </h3>
                        </div>
                        <p className={`mt-2 ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                            {error}
                        </p>
                        <button
                            onClick={resetResults}
                            className={`
                                mt-3 px-3 py-1 rounded text-sm
                                ${darkMode ? 'bg-red-800 hover:bg-red-700 text-white' : 'bg-red-100 hover:bg-red-200 text-red-800'}
                            `}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Success Results */}
                {campaignResult && (
                    <div className={`
                        p-6 rounded-lg border
                        ${darkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'}
                    `}>
                        <div className="flex items-center mb-4">
                            <svg className={`w-6 h-6 mr-2 ${darkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className={`text-lg font-semibold ${darkMode ? 'text-green-400' : 'text-green-800'}`}>
                                Campaign Sent Successfully!
                            </h3>
                        </div>
                        
                        {campaignResult.isTest ? (
                            <div className="mb-4">
                                <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                    <strong>Test Email Sent To:</strong> {campaignResult.testRecipient}
                                </p>
                                <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                    <strong>Campaign ID:</strong> {campaignResult.data.campaign_id}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                        <strong>Campaign ID:</strong> {campaignResult.data.campaign_id}
                                    </p>
                                    <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                        <strong>Total Recipients:</strong> {campaignResult.data.total_recipients}
                                    </p>
                                </div>
                                <div>
                                    <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                        <strong>Successful Sends:</strong> {campaignResult.data.successful_sends}
                                    </p>
                                    <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                        <strong>Failed Sends:</strong> {campaignResult.data.failed_sends}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <button
                            onClick={resetResults}
                            className={`
                                px-3 py-1 rounded text-sm
                                ${darkMode ? 'bg-green-800 hover:bg-green-700 text-white' : 'bg-green-100 hover:bg-green-200 text-green-800'}
                            `}
                        >
                            Close
                        </button>
                    </div>
                )}

                {/* Eligible Emails Modal */}
                <EligibleEmailsModal
                    isOpen={showEligibleModal}
                    onClose={handleCloseEligibleModal}
                    eligibleCustomers={eligibleCustomers}
                    onAddCustomRecipients={handleAddCustomRecipients}
                    darkMode={darkMode}
                />
            </div>
        </div>
    );
}

MarketingPanel.propTypes = {
    customers: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        Name: PropTypes.string.isRequired,
        Email: PropTypes.string.isRequired,
        f_noCom: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })).isRequired,
    darkMode: PropTypes.bool.isRequired
};

export default React.memo(MarketingPanel);