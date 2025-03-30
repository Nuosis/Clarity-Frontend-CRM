import { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import SnackBar from '../components/global/SnackBar';

const SnackBarContext = createContext(null);

export const useSnackBar = () => {
  const context = useContext(SnackBarContext);
  if (!context) {
    throw new Error('useSnackBar must be used within a SnackBarProvider');
  }
  return context;
};

export const SnackBarProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'error') => {
    setNotification({ message, type });
  }, []);

  const showError = useCallback((message) => {
    showNotification(message, 'error');
  }, [showNotification]);

  const showSuccess = useCallback((message) => {
    showNotification(message, 'success');
  }, [showNotification]);

  const showInfo = useCallback((message) => {
    showNotification(message, 'info');
  }, [showNotification]);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <SnackBarContext.Provider value={{ showError, showSuccess, showInfo }}>
      {children}
      {notification && (
        <SnackBar
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
        />
      )}
    </SnackBarContext.Provider>
  );
};

SnackBarProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SnackBarProvider;