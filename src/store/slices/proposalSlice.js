import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as proposalsAPI from '../../api/proposals'

// Async thunks - Real backend integration
export const createProposal = createAsyncThunk(
  'proposals/create',
  async (proposalData, { rejectWithValue }) => {
    try {
      console.log('[ProposalSlice] Creating proposal:', proposalData)
      const result = await proposalsAPI.createProposal(proposalData)

      if (!result.success) {
        return rejectWithValue(result.error)
      }

      return result.data
    } catch (error) {
      console.error('[ProposalSlice] Create proposal error:', error)
      return rejectWithValue(error.message)
    }
  }
)

export const fetchProposalsForProject = createAsyncThunk(
  'proposals/fetchForProject',
  async (projectId, { rejectWithValue }) => {
    try {
      console.log('[ProposalSlice] Fetching proposals for project:', projectId)
      const result = await proposalsAPI.fetchProposalsForProject(projectId)

      if (!result.success) {
        return rejectWithValue(result.error)
      }

      return result.data
    } catch (error) {
      console.error('[ProposalSlice] Fetch proposals error:', error)
      return rejectWithValue(error.message)
    }
  }
)

export const sendProposalEmail = createAsyncThunk(
  'proposals/sendEmail',
  async ({ proposal, customerEmail, customerName }, { rejectWithValue }) => {
    try {
      console.log('[ProposalSlice] Sending proposal email to:', customerEmail)
      // TODO: Implement actual email sending via backend API
      await new Promise(resolve => setTimeout(resolve, 800))
      return { success: true, messageId: `msg-${Date.now()}` }
    } catch (error) {
      console.error('[ProposalSlice] Send email error:', error)
      return rejectWithValue(error.message)
    }
  }
)

// Redux slice
const proposalSlice = createSlice({
  name: 'proposals',
  initialState: {
    proposals: [],
    currentProposal: null,
    loading: false,
    creating: false,
    sending: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createProposal.pending, (state) => {
        state.creating = true
        state.error = null
      })
      .addCase(createProposal.fulfilled, (state, action) => {
        state.creating = false
        state.currentProposal = action.payload
        state.proposals.push(action.payload)
      })
      .addCase(createProposal.rejected, (state, action) => {
        state.creating = false
        state.error = action.payload
      })
      .addCase(sendProposalEmail.pending, (state) => {
        state.sending = true
      })
      .addCase(sendProposalEmail.fulfilled, (state) => {
        state.sending = false
      })
      .addCase(sendProposalEmail.rejected, (state, action) => {
        state.sending = false
        state.error = action.payload
      })
      .addCase(fetchProposalsForProject.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProposalsForProject.fulfilled, (state, action) => {
        state.loading = false
        state.proposals = action.payload
      })
      .addCase(fetchProposalsForProject.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

// Selectors for components
export const selectProposalCreating = (state) => state.proposals.creating
export const selectProposalError = (state) => state.proposals.error
export const selectProposals = (state) => state.proposals.proposals
export const selectCurrentProposal = (state) => state.proposals.currentProposal

export const { clearError } = proposalSlice.actions
export default proposalSlice.reducer