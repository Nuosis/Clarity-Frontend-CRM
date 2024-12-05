// Utility functions for time management
export const formatDate = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const validateTimeAdjustment = (newStartTime) => {
  const now = Date.now();
  // Validate that the new start time is not in the future and not more than 24 hours in the past
  if (newStartTime > now || (now - newStartTime) > (24 * 60 * 60 * 1000)) {
    return false;
  }
  return true;
};

export const calculateElapsedMinutes = (startTime, endTime = Date.now()) => {
  const elapsedMinutes = Math.floor((endTime - startTime) / 60000);
  // Validate elapsed minutes is reasonable (not negative and not more than 24 hours)
  if (elapsedMinutes < 0 || elapsedMinutes > 1440) {
    return 0;
  }
  return elapsedMinutes;
};

export const validateStartDateTime = (dateStr, timeStr) => {
  try {
    let month, day, year;
    if (dateStr.includes('/')) {
      [month, day, year] = dateStr.split('/');
    } else if (dateStr.includes('-')) {
      [year, month, day] = dateStr.split('-');
    } else {
      return null;
    }
    
    const [hours, minutes, seconds] = timeStr.split(':');
    const startDateTime = new Date(year, parseInt(month) - 1, day, hours, minutes, seconds);
    
    // Validate the date is valid and not in the future
    if (isNaN(startDateTime.getTime()) || startDateTime > new Date()) {
      return null;
    }

    return startDateTime;
  } catch (error) {
    console.error('Error parsing date/time:', error);
    return null;
  }
};
