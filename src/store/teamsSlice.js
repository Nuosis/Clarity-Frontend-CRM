import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import FMGofer from 'fm-gofer';

export const fetchTeamsData = createAsyncThunk(
  'teams/fetchTeamsData',
  async (param, { rejectWithValue }) => {
    /* 
    * param {
        query: "[{}] ([n]<fieldName>:<fieldValue>)", 
        action: "string (read, metaData, create, update, delete, and duplicate)",
        recordId: "string (required for update, delete and duplicate)"
      }.
    */
    try {
      const response = await FMGofer.PerformScript('staff * JS * Teams Data', JSON.stringify(param));
      const data = typeof response === 'string' ? JSON.parse(response) : await response.json();
      console.log({data});
      
      // Handle empty response or no teams gracefully
      if (!data || !data.response || !data.response.data) {
        return { response: { data: [] } };
      }
      return data;
    } catch (error) {
      // Don't reject on 404 or empty responses
      if (error.message.includes('401') || error.message.includes('not found')) {
        return { response: { data: [] } };
      }
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  teams: [],
  selectedTeam: null,
  loading: false,
  error: null
};

export const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    setSelectedTeam: (state, action) => {
      state.selectedTeam = action.payload;
    },
    setTeams: (state, action) => {
      state.teams = action.payload?.response?.data || [];
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
    clearSelectedTeam: (state) => {
      state.selectedTeam = null;
    },
    clearTeamsData: (state) => {
      state.teams = [];
      state.selectedTeam = null;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeamsData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeamsData.fulfilled, (state, action) => {
        state.teams = action.payload?.response?.data || [];
        state.loading = false;
      })
      .addCase(fetchTeamsData.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        state.teams = [];
      });
  },
});

export const { 
  setSelectedTeam,
  setTeams,
  setLoading,
  setError,
  clearSelectedTeam,
  clearTeamsData
} = teamsSlice.actions;

export default teamsSlice.reducer;
