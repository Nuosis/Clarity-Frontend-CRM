export const createTimerManager = (dispatch) => {
  const startTimer = async ({
    startTime,
    billableManager,
    selectedProject,
    selectedProjectData,
    currentStaffId,
    taskId,
    taskDescription
  }) => {
    const billable = await billableManager.createBillableRecord({
      projectId: selectedProject,
      staffId: currentStaffId,
      taskId,
      startTime,
      description: taskDescription
    });

    if (!billable) return null;

    // Call FileMaker script with project ID
    const paramObject = { id: selectedProjectData?.fieldData?.__ID };
    FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));

    return billable;
  };

  const stopTimer = async ({
    billableRecordId,
    billableManager,
    endTime,
    minutes,
    onTimerStop,
    onReset
  }) => {
    if (billableRecordId) {
      await billableManager.updateBillableRecord(billableRecordId, {
        TimeEnd: endTime
      });
    }

    onTimerStop();

    if (minutes === 0) {
      onReset();
    }
  };

  const adjustTime = async ({
    newStartTime,
    billableRecordId,
    billableManager,
    selectedProject,
    selectedProjectData,
    onTimeAdjusted
  }) => {
    if (!validateTimeAdjustment(newStartTime) || !billableRecordId) return;

    const startDate = new Date(newStartTime);
    const updatedBill = await billableManager.updateStartTime(billableRecordId, startDate);
    
    if (updatedBill) {
      const elapsedMinutes = calculateElapsedMinutes(newStartTime);

      const paramObject = { id: selectedProjectData?.fieldData?.__ID };
      FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));

      onTimeAdjusted({
        elapsedMinutes,
        startTime: startDate
      });
    }
  };

  return {
    startTimer,
    stopTimer,
    adjustTime
  };
};

export const validateTimeAdjustment = (startTime) => {
  const now = new Date().getTime();
  const start = new Date(startTime).getTime();
  return start <= now;
};

export const calculateElapsedMinutes = (startTime) => {
  const now = new Date().getTime();
  return Math.floor((now - startTime) / (1000 * 60));
};
