import { useEffect } from 'react';
import PropTypes from 'prop-types';

const SnackBar = ({ message, type = 'error', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Choose background color based on message type
  const bgColorClass =
    type === 'success' ? 'bg-green-500' :
    type === 'info' ? 'bg-blue-500' :
    'bg-red-500'; // default to error

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg`}>
        {message}
      </div>
    </div>
  );
};

SnackBar.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['error', 'success', 'info']),
  onClose: PropTypes.func.isRequired,
};

export default SnackBar;