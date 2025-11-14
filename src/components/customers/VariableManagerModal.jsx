import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * VariableManagerModal - Manages email template variables with smart defaults
 * @param {Object} props - Component props
 * @param {string} props.htmlContent - The HTML content to scan for variables
 * @param {Object} props.prospect - The prospect data for smart defaults
 * @param {Function} props.onApply - Callback when variables are applied
 * @param {Function} props.onClose - Callback to close modal
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 */
function VariableManagerModal({ htmlContent, prospect, onApply, onClose, darkMode }) {
  const [variables, setVariables] = useState({});

  // Extract variables from HTML content (matches {{variableName}} and {% if variableName %})
  const detectedVariables = useMemo(() => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const conditionalRegex = /\{%\s*(?:if|elif)\s+(\w+)\s*%\}/g;
    const matches = [];
    let match;
    
    // Find {{variable}} patterns
    while ((match = variableRegex.exec(htmlContent)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    
    // Find {% if variable %} patterns
    while ((match = conditionalRegex.exec(htmlContent)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    
    return matches;
  }, [htmlContent]);

  // Detect if variable is used in conditional (boolean)
  const isConditionalVariable = useCallback((variableName) => {
    const conditionalRegex = new RegExp(`\\{%\\s*(?:if|elif)\\s+${variableName}\\s*%\\}`, 'g');
    return conditionalRegex.test(htmlContent);
  }, [htmlContent]);

  // Smart default mapping based on variable name
  const getSmartDefault = useCallback((variableName) => {
    const lowerVar = variableName.toLowerCase();
    
    // Check if this is a conditional variable (boolean)
    if (isConditionalVariable(variableName)) {
      // Boolean variables default to false
      return 'false';
    }
    
    // Name variations
    if (lowerVar.includes('name') || lowerVar === 'recipient') {
      const firstName = prospect?.FirstName || '';
      const lastName = prospect?.LastName || '';
      return `${firstName} ${lastName}`.trim() || '[Name]';
    }
    
    if (lowerVar.includes('firstname') || lowerVar === 'fname') {
      return prospect?.FirstName || '[First Name]';
    }
    
    if (lowerVar.includes('lastname') || lowerVar === 'lname') {
      return prospect?.LastName || '[Last Name]';
    }
    
    // Contact information
    if (lowerVar.includes('email')) {
      return prospect?.Email || '[Email]';
    }
    
    if (lowerVar.includes('phone')) {
      return prospect?.Phone || '[Phone]';
    }
    
    // Address variations
    if (lowerVar.includes('address') && !lowerVar.includes('line')) {
      const parts = [
        prospect?.AddressLine1,
        prospect?.AddressLine2,
        prospect?.City,
        prospect?.State,
        prospect?.PostalCode,
        prospect?.Country
      ].filter(Boolean);
      return parts.join(', ') || '[Address]';
    }
    
    if (lowerVar.includes('street') || lowerVar.includes('address1') || lowerVar.includes('addressline1')) {
      return prospect?.AddressLine1 || '[Street Address]';
    }
    
    if (lowerVar.includes('address2') || lowerVar.includes('addressline2')) {
      return prospect?.AddressLine2 || '[Address Line 2]';
    }
    
    if (lowerVar.includes('city')) {
      return prospect?.City || '[City]';
    }
    
    if (lowerVar.includes('state') || lowerVar.includes('province')) {
      return prospect?.State || '[State/Province]';
    }
    
    if (lowerVar.includes('zip') || lowerVar.includes('postal')) {
      return prospect?.PostalCode || '[Postal Code]';
    }
    
    if (lowerVar.includes('country')) {
      return prospect?.Country || '[Country]';
    }
    
    // Industry
    if (lowerVar.includes('industry')) {
      return prospect?.Industry || '[Industry]';
    }
    
    // Company (if available in prospect data)
    if (lowerVar.includes('company') || lowerVar.includes('organization')) {
      return prospect?.Company || '[Company]';
    }
    
    // Default fallback
    return `[${variableName}]`;
  }, [prospect, isConditionalVariable]);

  // Initialize variables with smart defaults
  useEffect(() => {
    const initialVars = {};
    detectedVariables.forEach(varName => {
      initialVars[varName] = getSmartDefault(varName);
    });
    setVariables(initialVars);
  }, [detectedVariables, getSmartDefault]);

  // Handle variable value change
  const handleVariableChange = useCallback((varName, value) => {
    setVariables(prev => ({
      ...prev,
      [varName]: value
    }));
  }, []);

  // Process conditional logic
  const processConditionals = useCallback((html, vars) => {
    let processed = html;
    
    // Process {% if variable %} ... {% elif variable %} ... {% else %} ... {% endif %}
    const ifBlockRegex = /\{%\s*if\s+(\w+)\s*%\}([\s\S]*?)(?:\{%\s*elif\s+(\w+)\s*%\}([\s\S]*?))*(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g;
    
    processed = processed.replace(ifBlockRegex, (match, ifVar, ifContent, elifVar, elifContent, elseContent) => {
      const ifValue = vars[ifVar];
      const isIfTrue = ifValue === 'true' || ifValue === true || (ifValue && ifValue !== 'false' && ifValue !== '0');
      
      if (isIfTrue) {
        return ifContent || '';
      }
      
      // Check elif if present
      if (elifVar && elifContent) {
        const elifValue = vars[elifVar];
        const isElifTrue = elifValue === 'true' || elifValue === true || (elifValue && elifValue !== 'false' && elifValue !== '0');
        if (isElifTrue) {
          return elifContent;
        }
      }
      
      // Return else content if present
      return elseContent || '';
    });
    
    return processed;
  }, []);

  // Apply variables to HTML
  const handleApply = useCallback(() => {
    let updatedHtml = htmlContent;
    
    // First, process conditional logic
    updatedHtml = processConditionals(updatedHtml, variables);
    
    // Then replace remaining {{variable}} placeholders
    Object.entries(variables).forEach(([varName, value]) => {
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      updatedHtml = updatedHtml.replace(regex, value);
    });
    
    onApply(updatedHtml);
    onClose();
  }, [htmlContent, variables, processConditionals, onApply, onClose]);

  // Reset to smart defaults
  const handleReset = useCallback(() => {
    const resetVars = {};
    detectedVariables.forEach(varName => {
      resetVars[varName] = getSmartDefault(varName);
    });
    setVariables(resetVars);
  }, [detectedVariables, getSmartDefault]);

  if (detectedVariables.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`
          p-6 rounded-lg max-w-md w-full mx-4
          ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
        `}>
          <h2 className="text-xl font-semibold mb-4">No Variables Found</h2>
          <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            No variables detected in the email content. Variables should be in the format <code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>{'{{variableName}}'}</code>
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Email Variables</h2>
          <button
            onClick={onClose}
            className={`
              p-1 rounded-full
              ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
            `}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className={`mb-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Found {detectedVariables.length} variable{detectedVariables.length !== 1 ? 's' : ''} in your email. 
          Smart defaults have been applied based on prospect data. You can customize any value below.
        </p>

        {/* Variables List */}
        <div className="space-y-4 mb-6">
          {detectedVariables.map(varName => {
            const isBoolean = isConditionalVariable(varName);
            return (
              <div key={varName}>
                <label className="block mb-1 font-medium">
                  <code className={`px-1.5 py-0.5 rounded text-sm ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {isBoolean ? `{% if ${varName} %}` : `{{${varName}}}`}
                  </code>
                  {isBoolean && (
                    <span className={`ml-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      (Boolean)
                    </span>
                  )}
                </label>
                {isBoolean ? (
                  <select
                    value={variables[varName] || 'false'}
                    onChange={(e) => handleVariableChange(varName, e.target.value)}
                    className={`
                      w-full p-2 rounded-md border
                      ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
                    `}
                  >
                    <option value="false">False</option>
                    <option value="true">True</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={variables[varName] || ''}
                    onChange={(e) => handleVariableChange(varName, e.target.value)}
                    className={`
                      w-full p-2 rounded-md border
                      ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
                    `}
                    placeholder={`Value for ${varName}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className={`
          p-3 rounded-md mb-6 text-sm
          ${darkMode ? 'bg-blue-900 bg-opacity-30 text-blue-200' : 'bg-blue-50 text-blue-800'}
        `}>
          <p className="font-medium mb-1">Smart Defaults Applied:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Name/recipient variables use prospect's full name</li>
            <li>Address variables use prospect's address fields</li>
            <li>Contact variables use email and phone</li>
            <li>Boolean variables (used in conditionals) default to false</li>
            <li>All values can be customized above</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className={`
              px-4 py-2 rounded-md font-medium
              ${darkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
            `}
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-md
                ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
              `}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Apply Variables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

VariableManagerModal.propTypes = {
  htmlContent: PropTypes.string.isRequired,
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
  onApply: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default React.memo(VariableManagerModal);