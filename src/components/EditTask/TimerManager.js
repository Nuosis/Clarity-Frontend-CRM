export const createTimerManager = (dispatch) => {
  const startTimer = async ({
    startTime,
    billableManager,
    selectedProject,
    currentStaffId,
    taskId,
    taskDescription,
    onTimerStart
  }) => {
    const billable = await billableManager.createBillableRecord({
      projectId: selectedProject,
      staffId: currentStaffId,
      taskId,
      startTime,
      description: taskDescription
    });

    if (billable) {
      const newRecordId = billable.recordId || billable.fieldData?.__ID;
      const elapsedMinutes = calculateElapsedMinutes(startTime.getTime());

      // Call FileMaker script with project ID
      const paramObject = { id: selectedProject };
      FileMaker.PerformScript("On Open Project DB", JSON.stringify(paramObject));

      // Immediately initialize timer state with the start time from the billable record
      const billableStartTime = new Date(`${billable.fieldData.DateStart} ${billable.fieldData.TimeStart}`);
      
      onTimerStart({
        recordId: newRecordId,
        elapsedMinutes: calculateElapsedMinutes(billableStartTime.getTime()),
        startTime: billableStartTime
      });
    }
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
    onTimeAdjusted
  }) => {
    if (!validateTimeAdjustment(newStartTime) || !billableRecordId) return;

    const startDate = new Date(newStartTime);
    const updatedBill = await billableManager.updateStartTime(billableRecordId, startDate);
    
    if (updatedBill) {
      const elapsedMinutes = calculateElapsedMinutes(newStartTime);

      const paramObject = { id: selectedProject };
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
