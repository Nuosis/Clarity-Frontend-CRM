import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import CustomerHeader from './CustomerHeader';
import ProspectForm from './ProspectForm';
import EmailCampaignEditor from './EmailCampaignEditor';

/**
 * ProspectDetails component - displays prospect information and tabs
 * @param {Object} props - Component props
 * @param {Object} props.prospect - The prospect object
 */
function ProspectDetails({ prospect }) {
  const { darkMode } = useTheme();
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [activeTab, setActiveTab] = useState('touch-history');

  const handleEditProspect = useCallback(() => {
    setShowProspectForm(true);
  }, []);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      {/* Prospect Header */}
      <CustomerHeader
        customer={prospect}
        stats={null}
        onEditProspect={handleEditProspect}
        isProspect={true}
      />

      {/* Prospect Form Modal */}
      {showProspectForm && (
        <ProspectForm
          prospect={prospect}
          onClose={() => setShowProspectForm(false)}
          darkMode={darkMode}
        />
      )}

      {/* Prospect Tabs */}
      <div>
        {/* Tab Headers */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('touch-history')}
            className={`px-4 py-2 font-medium focus:outline-none relative transition-colors ${
              activeTab === 'touch-history'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            style={{
              border: 'none',
              borderRadius: '0',
              borderBottom: activeTab === 'touch-history'
                ? '2px solid #004967'
                : '2px solid transparent',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'touch-history') {
                e.currentTarget.style.borderBottom = darkMode ? '2px solid #6b7280' : '2px solid #d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'touch-history') {
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            Touch History
          </button>
          <button
            onClick={() => setActiveTab('email-campaign')}
            className={`px-4 py-2 font-medium focus:outline-none relative transition-colors ${
              activeTab === 'email-campaign'
              ? `${darkMode ? 'text-white' : 'text-gray-800'}`
              : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
            style={{
              border: 'none',
              borderRadius: '0',
              borderBottom: activeTab === 'email-campaign'
                ? '2px solid #004967'
                : '2px solid transparent',
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'email-campaign') {
                e.currentTarget.style.borderBottom = darkMode ? '2px solid #6b7280' : '2px solid #d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'email-campaign') {
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            Email Campaign
          </button>
        </div>

        {/* Tab Content */}
        <div className={`
          p-4 rounded-lg border
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
          {activeTab === 'touch-history' && (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Touch History tracking coming soon...</p>
              <p className="text-sm mt-2">This will display email, SMS, meetings (Zoom, F2F, etc.) over time</p>
            </div>
          )}
          {activeTab === 'email-campaign' && (
            <EmailCampaignEditor
              prospectId={prospect.id}
              prospect={prospect}
              darkMode={darkMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}

ProspectDetails.propTypes = {
  prospect: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string.isRequired,
    Email: PropTypes.string,
    Phone: PropTypes.string,
    Industry: PropTypes.string
  }).isRequired
};

export default React.memo(ProspectDetails);