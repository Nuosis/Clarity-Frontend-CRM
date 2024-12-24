import { fetchBillablesData, setCurrentBill, clearCurrentBill, updateBillablesData } from '../../store/billablesSlice';
import { formatDate, formatTime } from './TimeManager';

export class BillableManager {
  constructor(dispatch) {
    this.dispatch = dispatch;
  }

  async createBillableRecord(data) {
    const { projectId, staffId, taskId, startTime, description } = data;
    
    const createResponse = await this.dispatch(fetchBillablesData({
      action: 'create',
      fieldData: {
        _projectID: projectId,
        _staffID: staffId,
        _taskID: taskId,
        DateStart: formatDate(startTime),
        TimeStart: formatTime(startTime),
        ["Work Performed"]: description
      }
    }));
    console.log({createResponse})

    if (createResponse.payload?.messages?.[0]?.code === "0" && createResponse.payload?.response?.recordId) {
      return this.fetchActiveBillable(taskId);
    }
    
    return null;
  }

  async fetchActiveBillable(taskId) {
    console.log("fetching active record...")
    const fetchResponse = await this.dispatch(fetchBillablesData({
      action: 'read',
      query: JSON.stringify([{
        _taskID: taskId,
        TimeEnd: "="  // FileMaker syntax for null/empty
      }])
    }));
    console.log("fetched record: ",fetchResponse)

    if (fetchResponse.payload?.response?.data?.[0]) {
      const billData = fetchResponse.payload.response.data[0];
      // Ensure we're setting currentBill with the raw billData
      this.dispatch(setCurrentBill({ response: { data: [billData] } }));
      return billData;
    }

    return null;
  }

  async updateBillableRecord(recordId, updates) {
    if (!recordId) return null;

    const response = await this.dispatch(fetchBillablesData({
      action: "update",
      recordId: recordId,
      fieldData: updates
    }));

    if (response.payload?.response?.data?.[0]) {
      const updatedBill = response.payload.response.data[0];
      this.dispatch(setCurrentBill({ response: { data: [updatedBill] } }));
      return updatedBill;
    }

    return null;
  }

  async finalizeBillable(recordId, endTime, description) {
    if (!recordId) return;

    const response = await this.updateBillableRecord(recordId, {
      TimeEnd: formatTime(endTime),
      ["Work Performed"]: description
    });

    if (response) {
      // Update the billables state with just this updated record
      this.dispatch(updateBillablesData({ 
        response: { 
          data: [response] 
        } 
      }));
    }

    this.dispatch(clearCurrentBill());
  }

  async updateStartTime(recordId, startTime) {
    if (!recordId) return null;

    return this.updateBillableRecord(recordId, {
      DateStart: formatDate(startTime),
      TimeStart: formatTime(startTime)
    });
  }

  clearBillable() {
    this.dispatch(clearCurrentBill());
  }
}

export const createBillableManager = (dispatch) => {
  return new BillableManager(dispatch);
};
