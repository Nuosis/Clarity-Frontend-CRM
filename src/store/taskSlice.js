import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import FMGofer from 'fm-gofer';

export const fetchTaskData = createAsyncThunk(
  'task/fetchTaskData',
  async (param, { rejectWithValue }) => {
    /* 
    * param {
        query: "[{}] ([n]<fieldName>:<fieldValue>)", 
        action: "string (read, metaData, create, update, delete, and duplicate)",
        recordId: "string (required for update, delete and duplicate)"
      }.
    */
    try {
      const response = await FMGofer.PerformScript('staff * JS * Task Data', JSON.stringify(param));
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      console.log({data})
      
      // Handle empty response or no tasks gracefully
      if (!data || !data.response || !data.response.data) {
        return { response: { data: [] } }; // Return empty array structure
      }
      return data;
    } catch (error) {
      // Don't reject on 404 or empty responses
      if (error.message.includes('401') || error.message.includes('not found')) {
        return { response: { data: [] } }; // Return empty array structure
      }
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  tasks: [],  // Initialize as empty array instead of null
  selectedTask: null,
  loading: false,
  error: null
};

export const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    setSelectedTask: (state, action) => {
      state.selectedTask = action.payload;
    },
    setTasks: (state, action) => {
      state.tasks = action.payload?.response?.data || [];
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
      .addCase(fetchTaskData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTaskData.fulfilled, (state, action) => {
        state.tasks = action.payload?.response?.data || [];
        state.loading = false;
      })
      .addCase(fetchTaskData.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        state.tasks = []; // Ensure tasks is empty array on error
      });
  },
});

export const { 
  setSelectedTask, 
  setTasks, 
  setLoading, 
  setError 
} = taskSlice.actions;

export default taskSlice.reducer;
