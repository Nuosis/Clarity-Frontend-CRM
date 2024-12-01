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
      state.currentBill = action.payload?.response?.data?.[0] || action.payload;
    },
    updateBillablesData: (state, action) => {
      const newRecords = action.payload?.response?.data || [];
      
      // Update existing records and add new ones based on ModificationTimestamp
      newRecords.forEach(newRecord => {
        const existingIndex = state.billablesData.findIndex(
          existing => existing.__ID === newRecord.__ID
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
        const newRecords = action.payload?.response?.data || [];
        
        // Update existing records and add new ones based on ModificationTimestamp
        newRecords.forEach(newRecord => {
          const existingIndex = state.billablesData.findIndex(
            existing => existing.__ID === newRecord.__ID
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
      })
      .addCase(fetchBillablesData.rejected, (state, action) => {
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
