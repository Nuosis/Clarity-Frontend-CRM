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
      param.layout = "devProjects"
      const response = await FMGofer.PerformScript('staff * JS * Fetch Data', JSON.stringify(param));
      // Parse the JSON response
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      // Ensure we return the data array from the response
      return data?.response?.data || [];
    } catch (error) {
      // Handle errors appropriately
      return rejectWithValue(error.message);
    }
  }
);

export const refreshProjects = createAsyncThunk(
  'project/refreshProjects',
  async (staffId, { rejectWithValue }) => {
    try {
      // Call the FileMaker script with the staff ID
      const response = await FMGofer.PerformScript('staff * JS * Project Data', staffId )
      // Parse the JSON response
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      // console.log("projectData",data)
      // Return the data array from the response
      return data?.response?.data || [];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  selectedProject: null,
  selectedCustomer: null,
  projectData: [],
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
      if (state.selectedProject?.fieldData && 
          (!action.payload || action.payload !== state.selectedProject.fieldData['Customers::Name'])) {
        state.selectedProject = null;
      }
    },
    setProjectData: (state, action) => {
      // Ensure projectData is always an array
      state.projectData = Array.isArray(action.payload) ? action.payload : [];
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
        // Ensure projectData is always an array
        state.projectData = Array.isArray(action.payload) ? action.payload : [];
        state.loading = false;
      })
      .addCase(fetchProjectData.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(refreshProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshProjects.fulfilled, (state, action) => {
        state.projectData = Array.isArray(action.payload) ? action.payload : [];
        state.loading = false;
      })
      .addCase(refreshProjects.rejected, (state, action) => {
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
