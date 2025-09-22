import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { backendConfig } from '../../config';

/**
 * Generate HMAC-SHA256 authentication header for backend API
 * @param {string} payload - Request payload
 * @returns {Promise<string>} Authorization header
 */
async function generateBackendAuthHeader(payload = '') {
  const secretKey = import.meta.env.VITE_SECRET_KEY;
  console.log('[DocumentProxy] Generating auth header, payload length:', payload.length);
  console.log('[DocumentProxy] Environment check:', {
    hasSecretKey: !!secretKey,
    secretKeyLength: secretKey?.length || 0,
    secretKeyPreview: secretKey ? secretKey.substring(0, 10) + '...' : 'NOT_FOUND'
  });
  
  if (!secretKey) {
    console.warn('[DocumentProxy] SECRET_KEY not available. Using hardcoded fallback for development.');
    // Use the correct secret key as fallback - this should match the backend
    const fallbackSecretKey = 'QArxVv0J1xggzd8Ai_Sk7TfFzllOflBJjVxA4kazpDo';
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}.${payload}`;
    
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(fallbackSecretKey);
      const messageData = encoder.encode(message);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const token = `Bearer ${signatureHex}.${timestamp}`;
      console.log('[DocumentProxy] Generated fallback HMAC token:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('[DocumentProxy] Fallback crypto operation failed:', error);
      const timestamp = Math.floor(Date.now() / 1000);
      const token = `Bearer dev-token.${timestamp}`;
      console.log('[DocumentProxy] Generated dev token as last resort:', token.substring(0, 20) + '...');
      return token;
    }
  }
  
  // Check if Web Crypto API is available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[DocumentProxy] Web Crypto API not available. Using fallback auth.');
    const timestamp = Math.floor(Date.now() / 1000);
    const token = `Bearer fallback-token.${timestamp}`;
    console.log('[DocumentProxy] Generated fallback token:', token.substring(0, 20) + '...');
    return token;
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${payload}`;
  console.log('[DocumentProxy] Creating signature for message length:', message.length);
  
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const token = `Bearer ${signatureHex}.${timestamp}`;
    console.log('[DocumentProxy] Generated HMAC token:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.warn('[DocumentProxy] Crypto operation failed, using fallback:', error);
    const timestamp = Math.floor(Date.now() / 1000);
    const token = `Bearer fallback-token.${timestamp}`;
    console.log('[DocumentProxy] Generated error fallback token:', token.substring(0, 20) + '...');
    return token;
  }
}

/**
 * SourceDocumentViewerModal component - displays source documents in a modal overlay
 * Handles X-Frame-Options restrictions by using backend proxy for seamless inline viewing
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Object} props.document - Document to display
 * @param {boolean} props.darkMode - Dark mode flag
 */
const SourceDocumentViewerModal = ({ isOpen, onClose, document, darkMode }) => {
  const [iframeError, setIframeError] = useState(false);
  const [proxyUrl, setProxyUrl] = useState(null);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState(false);
  const [forceProxy, setForceProxy] = useState(false);
  const iframeRef = useRef(null);

  // Check if URL needs proxy (GitHub URLs have X-Frame-Options restrictions)
  const needsProxy = useMemo(() => {
    if (!document?.download_url) return false;
    
    const url = document.download_url;
    console.log('[DocumentProxy] URL analysis:', {
      url: url.substring(0, 50) + '...',
      isGitHubUrl: url.includes('github.com') || url.includes('githubusercontent.com'),
      useProxy: url.includes('github.com') || url.includes('githubusercontent.com') || forceProxy,
      shouldProxy: url.includes('github.com') || url.includes('githubusercontent.com')
    });
    
    return url.includes('github.com') || url.includes('githubusercontent.com') || forceProxy;
  }, [document?.download_url, forceProxy]);

  // Generate proxy URL when needed
  useEffect(() => {
    const generateProxyUrl = async () => {
      if (!document?.download_url || !needsProxy) {
        console.log('[DocumentProxy] No proxy needed');
        setProxyUrl(null);
        return;
      }
      
      console.log('[DocumentProxy] Generating proxy URL for:', document.download_url.substring(0, 50) + '...');
      setIsGeneratingProxy(true);
      
      try {
        const encodedUrl = encodeURIComponent(document.download_url);
        const authHeader = await generateBackendAuthHeader();
        
        // Extract token from Bearer header for query parameter
        const token = authHeader.replace('Bearer ', '');
        
        // Generate proxy URL with auth token as query parameter (iframe-compatible)
        const proxyUrlString = `${backendConfig.baseUrl}/documents/proxy?url=${encodedUrl}&token=${encodeURIComponent(token)}`;
        console.log('[DocumentProxy] Generated proxy URL:', {
          proxyUrl: proxyUrlString.substring(0, 80) + '...',
          hasAuth: !!authHeader,
          authType: authHeader?.substring(0, 10) + '...',
          tokenLength: token.length
        });
        
        setProxyUrl({
          url: proxyUrlString,
          headers: { Authorization: authHeader }, // Keep for fetch requests
          isProxied: true
        });
      } catch (error) {
        console.error('[DocumentProxy] Failed to generate proxy URL:', error);
        setProxyUrl(null);
      } finally {
        setIsGeneratingProxy(false);
      }
    };

    generateProxyUrl();
  }, [document?.download_url, needsProxy]);

  // Determine the URL to use for iframe display
  const displayUrl = useMemo(() => {
    if (needsProxy && proxyUrl) {
      console.log('[DocumentViewer] Using proxy URL for iframe display');
      return proxyUrl.url;
    }
    console.log('[DocumentViewer] Using direct URL for iframe display');
    return document?.download_url;
  }, [document?.download_url, needsProxy, proxyUrl]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleIframeError = useCallback(() => {
    console.log('[DocumentViewer] Iframe error detected');
    console.log('[DocumentViewer] Current iframe src:', iframeRef.current?.src);
    console.log('[DocumentViewer] Current useProxy state:', needsProxy);
    console.log('[DocumentViewer] Current forceProxy state:', forceProxy);
    console.log('[DocumentViewer] Current proxyUrl:', proxyUrl ? 'Available' : 'Not available');
    
    if (!forceProxy) {
      console.log('[DocumentViewer] Switching to proxy mode due to iframe error');
      setIframeError(true);
      setForceProxy(true);
    } else {
      console.log('[DocumentViewer] Proxy mode also failed - both direct and proxy URLs failed');
      setIframeError(true);
    }
  }, [needsProxy, forceProxy, proxyUrl]);

  const handleOpenInNewTab = useCallback(() => {
    if (document?.download_url) {
      window.open(document.download_url, '_blank', 'noopener,noreferrer');
    }
  }, [document]);

  // Handle secure download through proxy
  const handleSecureDownload = useCallback(async () => {
    if (!proxyUrl) {
      console.warn('[DocumentProxy] No proxy URL available for secure download');
      return;
    }
    
    console.log('[DocumentProxy] Starting secure download via proxy');
    try {
      const response = await fetch(proxyUrl.url, {
        headers: proxyUrl.headers
      });
      
      console.log('[DocumentProxy] Proxy response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[DocumentProxy] Downloaded blob size:', blob.size, 'bytes');
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('[DocumentProxy] Secure download completed successfully');
    } catch (error) {
      console.error('[DocumentProxy] Secure download failed:', error);
      console.log('[DocumentProxy] Falling back to opening original URL');
      // Fallback to opening original URL
      handleOpenInNewTab();
    }
  }, [proxyUrl, document, handleOpenInNewTab]);

  // Reset error state when document changes
  useEffect(() => {
    if (document?.download_url) {
      console.log('[DocumentViewer] Document changed, resetting state for:', document.name);
      setIframeError(false);
      setForceProxy(false);
    }
  }, [document?.download_url]);

  // Add event listener for escape key
  useEffect(() => {
    if (isOpen) {
      window.document.addEventListener('keydown', handleKeyDown);
      return () => {
        window.document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !document) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className={`
        rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden
        ${darkMode ? 'bg-gray-800' : 'bg-white'}
      `}>
        {/* Modal Header */}
        <div className={`
          flex justify-between items-center p-4 border-b
          ${darkMode ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {document.name}
          </h2>
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

        {/* Modal Content */}
        <div className="overflow-auto max-h-[calc(90vh-80px)] p-6">
          {document.download_url ? (
            <div className="space-y-4">
              {/* Document Info and Actions DO NOT IMPLMENT REDUNDANT */}
              {/* <div className={`
                p-4 rounded-lg border
                ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}
              `}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{document.name}</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Size: {document.size ? `${(document.size / 1024).toFixed(1)} KB` : 'Unknown'}
                    </p>
                    {iframeError && (
                      <p className={`text-sm mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        Preview blocked by security policy - use "Open in New Tab" to view
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleOpenInNewTab}
                    className={`
                      px-4 py-2 rounded text-sm transition-colors
                      ${darkMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      }
                    `}
                  >
                    Open in New Tab
                  </button>
                </div>
              </div> */}

              {/* Document Preview */}
              <div className={`
                border rounded-lg overflow-hidden
                ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}
              `}>
                {document.name.toLowerCase().endsWith('.pdf') ? (
                  !iframeError ? (
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-2`}>
                      {isGeneratingProxy ? (
                        <div className={`
                          flex items-center justify-center h-96 rounded
                          ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}
                        `}>
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                            <p className="text-sm">Loading document...</p>
                          </div>
                        </div>
                      ) : (
                        <iframe
                          ref={iframeRef}
                          src={displayUrl}
                          className={`w-full h-96 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
                          title={document.name}
                          onError={handleIframeError}
                          onLoad={() => {
                            console.log('[DocumentViewer] Iframe loaded successfully');
                            console.log('[DocumentViewer] Final iframe src:', iframeRef.current?.src);
                            console.log('[DocumentViewer] Display URL used:', displayUrl);
                            console.log('[DocumentViewer] Using proxy mode:', needsProxy);
                            console.log('[DocumentViewer] Proxy URL available:', proxyUrl ? 'Yes' : 'No');
                            console.log('[DocumentViewer] Document name:', document.name);
                            setIframeError(false);
                          }}
                          style={{
                            backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                            filter: darkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none'
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className={`
                      p-8 text-center
                      ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}
                    `}>
                      <div className="mb-4">
                        <svg className={`mx-auto h-12 w-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {iframeError ? 'Preview Blocked' : 'PDF Preview'}
                      </p>
                      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {iframeError
                          ? 'This document cannot be displayed in a frame due to security restrictions.'
                          : 'PDF documents from external sources may not display inline.'
                        }
                      </p>
                      <div className="space-y-2">
                        {proxyUrl ? (
                          <button
                            onClick={handleSecureDownload}
                            className={`
                              w-full px-4 py-2 rounded text-sm transition-colors
                              ${darkMode
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-green-500 text-white hover:bg-green-600'
                              }
                            `}
                          >
                            Download Securely
                          </button>
                        ) : (
                          <button
                            onClick={handleOpenInNewTab}
                            className={`
                              w-full px-4 py-2 rounded text-sm transition-colors
                              ${darkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                              }
                            `}
                          >
                            Open PDF in New Tab
                          </button>
                        )}
                        {!forceProxy && !proxyUrl && (
                          <button
                            onClick={() => setForceProxy(true)}
                            className={`
                              w-full px-4 py-2 rounded text-sm transition-colors
                              ${darkMode
                                ? 'bg-gray-600 text-white hover:bg-gray-700'
                                : 'bg-gray-500 text-white hover:bg-gray-600'
                              }
                            `}
                          >
                            Try Secure Proxy
                          </button>
                        )}
                        {proxyUrl && (
                          <button
                            onClick={handleOpenInNewTab}
                            className={`
                              w-full px-4 py-2 rounded text-sm transition-colors
                              ${darkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                              }
                            `}
                          >
                            Open Original URL
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ) : document.name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-2`}>
                    <img
                      src={document.download_url}
                      alt={document.name}
                      className="w-full h-auto max-h-96 object-contain"
                      onError={() => {
                        // Handle image loading errors
                        console.warn('Failed to load image:', document.download_url);
                      }}
                    />
                  </div>
                ) : (
                  <div className={`
                    p-8 text-center
                    ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'}
                  `}>
                    <div className="mb-4">
                      <svg className={`mx-auto h-12 w-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Preview not available</p>
                    <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      This file type cannot be previewed inline
                    </p>
                    <button
                      onClick={handleOpenInNewTab}
                      className={`
                        px-4 py-2 rounded text-sm transition-colors
                        ${darkMode
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                        }
                      `}
                    >
                      Open in New Tab
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`
              p-8 text-center
              ${darkMode ? 'text-gray-400' : 'text-gray-600'}
            `}>
              <div className="mb-4">
                <svg className={`mx-auto h-12 w-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Document not available</p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This document cannot be displayed at the moment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

SourceDocumentViewerModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  document: PropTypes.shape({
    name: PropTypes.string.isRequired,
    size: PropTypes.number,
    download_url: PropTypes.string,
    path: PropTypes.string,
    type: PropTypes.string
  }),
  darkMode: PropTypes.bool.isRequired
};

export default SourceDocumentViewerModal;