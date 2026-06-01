import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as proposalsAPI from '../../api/proposals'

const normalizeProposal = (proposal) => {
  if (!proposal) return proposal
  return {
    ...proposal,
    total_price: Number(proposal.total_price || 0),
    selected_price: proposal.selected_price == null ? null : Number(proposal.selected_price),
    deliverables: (proposal.deliverables || []).map((deliverable) => ({
      ...deliverable,
      price: Number(deliverable.price || 0),
      order: deliverable.sort_order ?? deliverable.order ?? 0,
      estimated_hours: deliverable.estimated_time ?? deliverable.estimated_hours ?? null,
      type: deliverable.type || 'fixed'
    }))
  }
}

// Async thunks
export const fetchProposalByToken = createAsyncThunk(
  'proposalViewer/fetchByToken',
  async (token, { rejectWithValue }) => {
    try {
      const result = await proposalsAPI.claimPublicProposalSession(token)
      if (!result.success) {
        return rejectWithValue(result.error)
      }
      return normalizeProposal(result.data)
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch proposal')
    }
  }
)

export const approveProposal = createAsyncThunk(
  'proposalViewer/approve',
  async ({ selectedDeliverables, customerName, customerEmail }, { rejectWithValue }) => {
    try {
      const result = await proposalsAPI.acceptPublicProposal({
        selectedDeliverables,
        customerName,
        customerEmail,
        depositPercent: 50,
        currency: 'cad'
      })
      if (!result.success) {
        return rejectWithValue(result.error)
      }
      return result.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to approve proposal')
    }
  }
)

// Redux slice
const proposalViewerSlice = createSlice({
  name: 'proposalViewer',
  initialState: {
    // Proposal data
    proposal: null,
    
    // Selection state
    selectedDeliverables: [],
    totalPrice: 0,
    
    // Loading states
    loading: false,
    approving: false,
    
    // Error states
    error: null,
    approvalError: null,
    checkoutUrl: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null
      state.approvalError = null
      state.checkoutUrl = null
    },
    
    toggleDeliverable: (state, action) => {
      const deliverableId = action.payload
      const index = state.selectedDeliverables.indexOf(deliverableId)
      
      if (index > -1) {
        // Remove if already selected (unless required)
        const deliverable = state.proposal?.deliverables?.find(d => d.id === deliverableId)
        if (!deliverable?.is_required) {
          state.selectedDeliverables.splice(index, 1)
        }
      } else {
        // Add if not selected
        state.selectedDeliverables.push(deliverableId)
      }
      
      // Recalculate total price
      if (state.proposal?.deliverables) {
        state.totalPrice = state.proposal.deliverables
          .filter(d => state.selectedDeliverables.includes(d.id))
          .reduce((sum, d) => sum + parseFloat(d.price), 0)
      }
    },
    
    resetViewer: (state) => {
      state.proposal = null
      state.selectedDeliverables = []
      state.totalPrice = 0
      state.error = null
      state.approvalError = null
      state.checkoutUrl = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch proposal by token
      .addCase(fetchProposalByToken.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProposalByToken.fulfilled, (state, action) => {
        state.loading = false
        state.proposal = action.payload
        
        // Initialize selected deliverables with required ones and pre-selected ones
        state.selectedDeliverables = action.payload.deliverables
          ?.filter(d => d.is_required || d.is_selected)
          ?.map(d => d.id) || []
        
        // Calculate initial total price
        state.totalPrice = action.payload.deliverables
          ?.filter(d => state.selectedDeliverables.includes(d.id))
          ?.reduce((sum, d) => sum + parseFloat(d.price), 0) || 0
      })
      .addCase(fetchProposalByToken.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Approve proposal
      .addCase(approveProposal.pending, (state) => {
        state.approving = true
        state.approvalError = null
      })
      .addCase(approveProposal.fulfilled, (state, action) => {
        state.approving = false
        state.checkoutUrl = action.payload.checkout_url || null
        if (action.payload.selected_proposal) {
          state.proposal = normalizeProposal(action.payload.selected_proposal)
        }
      })
      .addCase(approveProposal.rejected, (state, action) => {
        state.approving = false
        state.approvalError = action.payload
      })
  }
})

// Actions
export const { clearError, toggleDeliverable, resetViewer } = proposalViewerSlice.actions

// Selectors
export const selectViewerProposal = (state) => state.proposalViewer.proposal
export const selectSelectedDeliverables = (state) => state.proposalViewer.selectedDeliverables
export const selectTotalPrice = (state) => state.proposalViewer.totalPrice
export const selectViewerLoading = (state) => state.proposalViewer.loading
export const selectViewerApproving = (state) => state.proposalViewer.approving
export const selectViewerError = (state) => state.proposalViewer.error
export const selectApprovalError = (state) => state.proposalViewer.approvalError
export const selectCheckoutUrl = (state) => state.proposalViewer.checkoutUrl

// Reducer
export default proposalViewerSlice.reducer
