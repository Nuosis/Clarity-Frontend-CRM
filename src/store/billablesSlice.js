import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import FMGofer from 'fm-gofer';

export const fetchBillablesData = createAsyncThunk(
  'billables/fetchBillablesData',
  async (param, { rejectWithValue }) => {
    try {
      const response = await FMGofer.PerformScript('staff * JS * Billables Data', JSON.stringify(param));
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      console.log({data});
      
      if (!data || !data.response || !data.response.data) {
        return { response: { data: [] } };
      }
      return data;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('not found')) {
        return { response: { data: [] } };
      }
      return rejectWithValue(error.message);
    }
  }
);

export const createBillableRecord = createAsyncThunk(
  'billables/createBillableRecord',
  async (billableData, { rejectWithValue }) => {
    try {
      const param = {
        action: 'create',
        fieldData: {
          _projectID: billableData.projectId,
          _staffID: billableData.staffId,
          DateStart: billableData.dateStart,
          TimeStart: billableData.timeStart,
          TimeEnd: billableData.timeEnd,
          ["Work Performed"]: billableData.workPerformed
        }
      };

      const response = await FMGofer.PerformScript('staff * JS * Billables Data', JSON.stringify(param));
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  billablesData: [],
  currentBill: null,
  loading: false,
  error: null
};

export const billablesSlice = createSlice({
  name: 'billables',
  initialState,
  reducers: {
    setBillablesData: (state, action) => {
      state.billablesData = action.payload?.map(record => record.fieldData) || [];
      state.loading = false;
      state.error = null;
    },
    setCurrentBill: (state, action) => {
      state.currentBill = action.payload;
    },
    clearCurrentBill: (state) => {
      state.currentBill = null;
    },
    clearBillablesData: (state) => {
      state.billablesData = [];
      state.currentBill = null;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBillablesData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBillablesData.fulfilled, (state, action) => {
        state.billablesData = action.payload?.response?.data?.map(record => record.fieldData) || [];
        state.loading = false;
      })
      .addCase(fetchBillablesData.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        state.billablesData = [];
      })
      .addCase(createBillableRecord.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBillableRecord.fulfilled, (state, action) => {
        // Store the created billable as current
        if (action.payload?.response?.data?.[0]) {
          state.currentBill = action.payload.response.data[0];
        }
        state.loading = false;
      })
      .addCase(createBillableRecord.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  }
});

export const { 
  setBillablesData, 
  setCurrentBill,
  clearCurrentBill,
  clearBillablesData,
  setLoading, 
  setError 
} = billablesSlice.actions;

export default billablesSlice.reducer;
