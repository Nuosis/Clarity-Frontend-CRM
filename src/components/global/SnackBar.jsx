import { useEffect } from 'react';
import PropTypes from 'prop-types';

const SnackBar = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
        {message}
      </div>
    </div>
  );
};

SnackBar.propTypes = {
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SnackBar;