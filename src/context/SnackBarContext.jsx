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
  const [error, setError] = useState(null);

  const showError = useCallback((message) => {
    setError(message);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <SnackBarContext.Provider value={{ showError }}>
      {children}
      {error && <SnackBar message={error} onClose={clearError} />}
    </SnackBarContext.Provider>
  );
};

SnackBarProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SnackBarProvider;