import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

// Mock API function - will be replaced with actual API integration
const mockFetchProposalByToken = async (token) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mock proposal data
  return {
    id: 'prop-123',
    title: 'Website Redesign Proposal',
    description: 'Complete redesign of your company website with modern UI/UX',
    status: 'sent',
    access_token: token,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    request_summary: {
      overview: 'This project involves a complete redesign of your existing website to improve user experience, modernize the visual design, and enhance mobile responsiveness.',
      objectives: [
        'Improve user engagement and conversion rates',
        'Modernize visual design and branding',
        'Enhance mobile responsiveness',
        'Optimize for search engines'
      ],
      timeline: '6-8 weeks',
      budget: 15000
    },
    concepts: [
      {
        id: 'concept-1',
        title: 'Homepage Wireframe',
        description: 'Initial wireframe showing the new homepage layout and structure',
        type: 'wireframe',
        url: 'https://via.placeholder.com/800x600/007bff/ffffff?text=Homepage+Wireframe',
        thumbnailUrl: 'https://via.placeholder.com/400x300/007bff/ffffff?text=Homepage+Wireframe',
        order: 0
      },
      {
        id: 'concept-2',
        title: 'Design Mockups',
        description: 'High-fidelity mockups showing the final visual design',
        type: 'mockup',
        url: 'https://via.placeholder.com/800x600/28a745/ffffff?text=Design+Mockups',
        thumbnailUrl: 'https://via.placeholder.com/400x300/28a745/ffffff?text=Design+Mockups',
        order: 1
      }
    ],
    deliverables: [
      {
        id: 'deliv-1',
        title: 'Homepage Design & Development',
        description: 'Complete design and development of the new homepage',
        price: 5000,
        type: 'fixed',
        estimated_hours: null,
        is_selected: true,
        is_required: true,
        order: 0
      },
      {
        id: 'deliv-2',
        title: 'About & Services Pages',
        description: 'Design and development of about and services pages',
        price: 3000,
        type: 'fixed',
        estimated_hours: null,
        is_selected: true,
        is_required: false,
        order: 1
      },
      {
        id: 'deliv-3',
        title: 'Contact & Blog Pages',
        description: 'Design and development of contact and blog pages',
        price: 2500,
        type: 'fixed',
        estimated_hours: null,
        is_selected: false,
        is_required: false,
        order: 2
      },
      {
        id: 'deliv-4',
        title: 'SEO Optimization',
        description: 'Search engine optimization for all pages',
        price: 1500,
        type: 'fixed',
        estimated_hours: null,
        is_selected: true,
        is_required: false,
        order: 3
      }
    ],
    total_price: 12000,
    selected_price: 9500
  }
}

// Async thunks
export const fetchProposalByToken = createAsyncThunk(
  'proposalViewer/fetchByToken',
  async (token, { rejectWithValue }) => {
    try {
      const proposal = await mockFetchProposalByToken(token)
      return proposal
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch proposal')
    }
  }
)

export const approveProposal = createAsyncThunk(
  'proposalViewer/approve',
  async ({ proposalId, selectedDeliverables, totalPrice }, { rejectWithValue }) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock approval process
      console.log('Approving proposal:', { proposalId, selectedDeliverables, totalPrice })
      
      return {
        proposalId,
        selectedDeliverables,
        totalPrice,
        approvedAt: new Date().toISOString()
      }
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
    approvalError: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null
      state.approvalError = null
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
        if (state.proposal) {
          state.proposal.status = 'approved'
          state.proposal.approved_at = action.payload.approvedAt
          state.proposal.selected_price = action.payload.totalPrice
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

// Reducer
export default proposalViewerSlice.reducer