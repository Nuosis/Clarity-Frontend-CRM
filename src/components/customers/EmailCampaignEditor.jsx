import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import VariableManagerModal from './VariableManagerModal';
import { sendEmail } from '../../api/mailjet';
import { isValidEmail } from '../../utils/validation';

/**
 * EmailCampaignEditor component - HTML editor with code/preview toggle
 * @param {Object} props - Component props
 * @param {string} props.prospectId - The prospect ID for session storage key
 * @param {Object} props.prospect - The prospect data for variable substitution
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 */
function EmailCampaignEditor({ prospectId, prospect, darkMode }) {
  const [htmlContent, setHtmlContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [viewMode, setViewMode] = useState('code'); // 'code' or 'preview'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // 'success' | 'error' | null

  // Session storage keys for this prospect's email
  const storageKey = `email_campaign_${prospectId}`;
  const subjectStorageKey = `email_subject_${prospectId}`;

  // Load saved content from session storage on mount
  useEffect(() => {
    const savedContent = sessionStorage.getItem(storageKey);
    const savedSubject = sessionStorage.getItem(subjectStorageKey);
    if (savedContent) {
      setHtmlContent(savedContent);
    }
    if (savedSubject) {
      setEmailSubject(savedSubject);
    }
  }, [storageKey, subjectStorageKey]);

  // Handle content change
  const handleContentChange = useCallback((e) => {
    const newContent = e.target.value;
    setHtmlContent(newContent);
    setHasUnsavedChanges(true);
  }, []);

  // Handle subject change
  const handleSubjectChange = useCallback((e) => {
    const newSubject = e.target.value;
    setEmailSubject(newSubject);
    setHasUnsavedChanges(true);
  }, []);

  // Save to session storage
  const handleSave = useCallback(() => {
    sessionStorage.setItem(storageKey, htmlContent);
    sessionStorage.setItem(subjectStorageKey, emailSubject);
    setHasUnsavedChanges(false);
  }, [storageKey, subjectStorageKey, htmlContent, emailSubject]);

  // Clear content
  const handleClear = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the email content?')) {
      setHtmlContent('');
      setEmailSubject('');
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(subjectStorageKey);
      setHasUnsavedChanges(false);
      setSendStatus(null);
    }
  }, [storageKey, subjectStorageKey]);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'code' ? 'preview' : 'code');
  }, []);

  // Open variable manager
  const handleManageVariables = useCallback(() => {
    setShowVariableModal(true);
  }, []);

  // Apply variables from modal
  const handleApplyVariables = useCallback((updatedHtml) => {
    setHtmlContent(updatedHtml);
    setHasUnsavedChanges(true);
  }, []);

  // Send email via Mailjet backend API
  const handleSendEmail = useCallback(async () => {
    // Validation
    if (!htmlContent.trim()) {
      alert('Please create email content first');
      return;
    }

    if (!emailSubject.trim()) {
      alert('Please enter an email subject');
      return;
    }

    if (!prospect.Email || !isValidEmail(prospect.Email)) {
      alert(`Invalid prospect email address: "${prospect.Email || 'No email provided'}"`);
      return;
    }

    // Confirm send
    const recipientName = `${prospect.FirstName || ''} ${prospect.LastName || ''}`.trim() || 'this prospect';
    if (!window.confirm(`Send email to ${recipientName} (${prospect.Email})?`)) {
      return;
    }

    setIsSending(true);
    setSendStatus(null);

    try {
      // Send email using backend Mailjet API
      await sendEmail({
        from_email: {
          email: 'marcus@claritybusinesssolutions.ca',
          name: 'Marcus Swift'
        },
        to: [{
          email: prospect.Email,
          name: recipientName
        }],
        subject: emailSubject,
        html_part: htmlContent,
        text_part: 'Email from Clarity Business Solutions'
      });

      setSendStatus('success');
      alert('Email sent successfully!');
      // Clear unsaved changes flag since email was sent
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error sending email:', error);
      setSendStatus('error');
      alert(`Error sending email: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  }, [htmlContent, emailSubject, prospect]);

  return (
    <div className="space-y-4">
      {/* Subject Line Input */}
      <div className="space-y-2">
        <label 
          htmlFor="email-subject"
          className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Email Subject
        </label>
        <input
          id="email-subject"
          type="text"
          value={emailSubject}
          onChange={handleSubjectChange}
          placeholder="Enter email subject..."
          className={`
            w-full px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500
            ${darkMode 
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}
          `}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <button
            onClick={toggleViewMode}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2
              ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
            `}
          >
            {viewMode === 'code' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Code
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${hasUnsavedChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClear}
            disabled={!htmlContent}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${htmlContent
                ? darkMode
                  ? 'bg-red-900 hover:bg-red-800 text-white'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>

          {/* Manage Variables Button */}
          <button
            onClick={handleManageVariables}
            disabled={!htmlContent}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${htmlContent
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Variables
          </button>

          {/* Send Email Button */}
          <button
            onClick={handleSendEmail}
            disabled={!htmlContent || !emailSubject || isSending}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${htmlContent && emailSubject && !isSending
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
            title={
              !htmlContent ? 'Create email content first' :
              !emailSubject ? 'Enter email subject first' :
              isSending ? 'Sending...' :
              'Send email to prospect'
            }
          >
            {isSending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Email
              </>
            )}
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Unsaved changes
            </span>
          )}
          {sendStatus === 'success' && (
            <span className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
              ✓ Email sent
            </span>
          )}
          {sendStatus === 'error' && (
            <span className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
              ✗ Send failed
            </span>
          )}
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className={`
        rounded-lg border overflow-hidden
        ${darkMode ? 'border-gray-700' : 'border-gray-300'}
      `}>
        {viewMode === 'code' ? (
          /* Code Editor */
          <textarea
            value={htmlContent}
            onChange={handleContentChange}
            placeholder="Enter your HTML email content here..."
            className={`
              w-full h-[500px] p-4 font-mono text-sm resize-none focus:outline-none
              ${darkMode 
                ? 'bg-gray-900 text-gray-100 placeholder-gray-500' 
                : 'bg-white text-gray-900 placeholder-gray-400'}
            `}
            spellCheck={false}
          />
        ) : (
          /* Preview */
          <div className={`
            w-full h-[500px] overflow-auto p-4
            ${darkMode ? 'bg-white' : 'bg-white'}
          `}>
            {htmlContent ? (
              <iframe
                title="Email Preview"
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No content to preview
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <div className={`
        text-sm p-3 rounded-md
        ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-600'}
      `}>
        <p className="font-medium mb-1">Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Enter an email subject line</li>
          <li>Write your HTML email content in the code editor</li>
          <li>Use variables like <code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>{'{{recipient}}'}</code> or <code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>{'{{email}}'}</code> for dynamic content</li>
          <li>Click "Manage Variables" to auto-populate and customize variable values</li>
          <li>Toggle to preview mode to see how it will look</li>
          <li>Click "Send Email" to send via Mailjet (requires valid prospect email)</li>
          <li>Content is automatically saved to your session</li>
          <li>Use standard HTML email best practices (inline styles, tables for layout)</li>
        </ul>
      </div>

      {/* Variable Manager Modal */}
      {showVariableModal && (
        <VariableManagerModal
          htmlContent={htmlContent}
          prospect={prospect}
          onApply={handleApplyVariables}
          onClose={() => setShowVariableModal(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

EmailCampaignEditor.propTypes = {
  prospectId: PropTypes.string.isRequired,
  prospect: PropTypes.shape({
    FirstName: PropTypes.string,
    LastName: PropTypes.string,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string,
    AddressLine1: PropTypes.string,
    AddressLine2: PropTypes.string,
    City: PropTypes.string,
    State: PropTypes.string,
    PostalCode: PropTypes.string,
    Country: PropTypes.string,
    Company: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(EmailCampaignEditor);