import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import FMGofer from 'fm-gofer';

export const fetchBillablesData = createAsyncThunk(
  'billables/fetchBillablesData',
  /* 
  * param {
      query: "[{}] ([n]<fieldName>:<fieldValue>)", 
      action: "string (read, metaData, create, update, delete, and duplicate)",
      recordId: "string (required for update, delete and duplicate)"
    }.
  */
  async (param, { rejectWithValue }) => {
    try {
      param.layout = "dapiRecords";
      const response = await FMGofer.PerformScript('staff * JS * Fetch Data', JSON.stringify(param));
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      console.log('Raw FileMaker response:', response); // Debug log
      console.log('Parsed data:', data); // Debug log
      
      if (!data || !data.response || !data.response.data) {
        console.log('No data in response, returning empty array'); // Debug log
        return { response: { data: [] } };
      }

      // Ensure we're returning the full response object
      console.log('Returning data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error in fetchBillablesData:', error); // Debug log
      if (error.message.includes('401') || error.message.includes('not found')) {
        return { response: { data: [] } };
      }
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  billablesData: [],
  currentBill: null,
  loading: false,
  error: null,
  lastFetched: null
};

export const billablesSlice = createSlice({
  name: 'billables',
  initialState,
  reducers: {
    setBillablesData: (state, action) => {
      // Directly use the data array if it's already in the correct format
      const data = Array.isArray(action.payload) ? action.payload : 
                  action.payload?.response?.data || [];
      state.billablesData = data;
      state.lastFetched = new Date().toISOString();
      state.loading = false;
      state.error = null;
      console.log("Redux state updated with billables:", state.billablesData);
    },
    setCurrentBill: (state, action) => {
      console.log('setCurrentBill called with:', action.payload); // Debug log
      const billData = action.payload?.response?.data?.[0] || action.payload;
      
      // Only update if the new bill is different from the current one
      if (!state.currentBill || 
          billData?.fieldData?.__ID !== state.currentBill?.fieldData?.__ID ||
          billData?.recordId !== state.currentBill?.recordId) {
        console.log('Setting currentBill to:', billData); // Debug log
        state.currentBill = billData;
      }
    },
    updateBillablesData: (state, action) => {
      const newRecords = action.payload?.response?.data || [];
      console.log('updateBillablesData called with:', newRecords); // Debug log
      
      // Update existing records and add new ones based on ModificationTimestamp
      newRecords.forEach(newRecord => {
        const existingIndex = state.billablesData.findIndex(
          existing => existing.fieldData?.__ID === newRecord.fieldData?.__ID
        );
        
        if (existingIndex !== -1) {
          const newModTime = new Date(newRecord['~ModificationTimestamp']);
          const existingModTime = new Date(state.billablesData[existingIndex]['~ModificationTimestamp']);
          
          if (newModTime > existingModTime) {
            state.billablesData[existingIndex] = newRecord;
          }
        } else {
          state.billablesData.push(newRecord);
        }
      });
      
      state.lastFetched = new Date().toISOString();
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearCurrentBill: (state) => {
      console.log('Clearing current bill'); // Debug log
      state.currentBill = null;
    },
    clearBillablesData: (state) => {
      state.billablesData = [];
      state.currentBill = null;
      state.loading = false;
      state.error = null;
      state.lastFetched = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBillablesData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBillablesData.fulfilled, (state, action) => {
        console.log('fetchBillablesData.fulfilled with action:', action); // Debug log
        const newRecords = action.payload?.response?.data || [];
        console.log('Extracted newRecords:', newRecords); // Debug log
        
        // Update existing records and add new ones based on ModificationTimestamp
        newRecords.forEach(newRecord => {
          console.log('Processing record:', newRecord); // Debug log
          const existingIndex = state.billablesData.findIndex(
            existing => existing.fieldData?.__ID === newRecord.fieldData?.__ID
          );
          
          if (existingIndex !== -1) {
            const newModTime = new Date(newRecord['~ModificationTimestamp']);
            const existingModTime = new Date(state.billablesData[existingIndex]['~ModificationTimestamp']);
            
            if (newModTime > existingModTime) {
              state.billablesData[existingIndex] = newRecord;
            }
          } else {
            state.billablesData.push(newRecord);
          }
        });

        // Only update currentBill for create/update actions if it's relevant
        if (newRecords.length > 0 && 
            (!state.currentBill || 
             newRecords[0].fieldData?.__ID === state.currentBill?.fieldData?.__ID)) {
          console.log('Setting currentBill in fulfilled to:', newRecords[0]); // Debug log
          state.currentBill = newRecords[0];
        } else {
          console.log('Skipping currentBill update'); // Debug log
        }
        
        state.lastFetched = new Date().toISOString();
        state.loading = false;
      })
      .addCase(fetchBillablesData.rejected, (state, action) => {
        console.error('fetchBillablesData rejected:', action.payload); // Debug log
        state.error = action.payload;
        state.loading = false;
      });
  }
});

export const { 
  setBillablesData, 
  setCurrentBill,
  updateBillablesData,
  clearCurrentBill,
  clearBillablesData,
  setLoading, 
  setError 
} = billablesSlice.actions;

export default billablesSlice.reducer;
