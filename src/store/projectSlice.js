import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import FMGofer, { Option } from 'fm-gofer';

export const fetchProjectData = createAsyncThunk(
  'project/fetchProjectData',
  async (param, { rejectWithValue }) => {
    /* 
    * param {
        query: "[{}] ([n]<fieldName>:<fieldValue>)", 
        action: "string (read, metaData, create, update, delete, and duplicate)",
        recordId: "string (required for update, delete and duplicate)"
      }.
    */
    try {
      // Call the FileMaker script using FMGofer
      const response = await FMGofer.PerformScript('staff * JS * Project Data', JSON.stringify(param));
      // Parse the JSON response
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      return data;
    } catch (error) {
      // Handle errors appropriately
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  selectedProject: null,
  selectedCustomer: null,
  projectData: null,
  loading: false,
  error: null
};

export const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setSelectedProject: (state, action) => {
      state.selectedProject = action.payload;
    },
    setSelectedCustomer: (state, action) => {
      state.selectedCustomer = action.payload;
      // Clear selected project when customer changes
      if (state.selectedProject && (!action.payload || action.payload !== state.selectedProject.fieldData['Customers::Name'])) {
        state.selectedProject = null;
      }
    },
    setProjectData: (state, action) => {
      state.projectData = action.payload;
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
      .addCase(fetchProjectData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectData.fulfilled, (state, action) => {
        state.projectData = action.payload;
        state.loading = false;
      })
      .addCase(fetchProjectData.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  },
});

export const { 
  setSelectedProject, 
  setSelectedCustomer,
  setProjectData, 
  setLoading, 
  setError 
} = projectSlice.actions;

export default projectSlice.reducer;
