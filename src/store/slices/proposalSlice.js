import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

// Mock API functions - WIREFRAME PLACEHOLDER
const mockCreateProposal = async (proposalData) => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return {
    id: `prop-${Date.now()}`,
    access_token: `token-${crypto.randomUUID()}`,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...proposalData
  }
}

// Async thunks - WIREFRAME IMPLEMENTATION
export const createProposal = createAsyncThunk(
  'proposals/create',
  async (proposalData, { rejectWithValue }) => {
    try {
      const result = await mockCreateProposal(proposalData)
      return result
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchProposalsForProject = createAsyncThunk(
  'proposals/fetchForProject',
  async (projectId, { rejectWithValue }) => {
    try {
      // WIREFRAME: Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const mockProposals = [
        {
          id: 'prop-1',
          title: 'Website Development Proposal',
          description: 'Complete website development with modern design and functionality',
          status: 'sent',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          total_price: 12000,
          selected_price: 9500,
          access_token: 'token-mock-proposal-1',
          concepts: [
            {
              id: 'concept-1',
              title: 'Homepage Wireframe',
              description: 'Initial wireframe showing the layout and structure of the homepage with navigation, hero section, and key content areas.',
              type: 'wireframe',
              url: 'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Homepage+Wireframe',
              thumbnailUrl: 'https://via.placeholder.com/200x150/4F46E5/FFFFFF?text=Homepage',
              order: 0
            },
            {
              id: 'concept-2',
              title: 'Brand Color Palette',
              description: 'Proposed color scheme and visual identity elements that will be used throughout the website design.',
              type: 'mockup',
              url: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Color+Palette',
              thumbnailUrl: 'https://via.placeholder.com/200x150/10B981/FFFFFF?text=Colors',
              order: 1
            }
          ],
          deliverables: [
            {
              id: 'deliv-1',
              title: 'Website Design & Development',
              description: 'Complete responsive website with modern design, including all pages and functionality.',
              price: 8500,
              type: 'fixed',
              estimatedHours: 120,
              isRequired: true,
              order: 0
            },
            {
              id: 'deliv-2',
              title: 'Content Management System',
              description: 'Custom CMS for easy content updates and management.',
              price: 2500,
              type: 'fixed',
              estimatedHours: 35,
              isRequired: false,
              order: 1
            },
            {
              id: 'deliv-3',
              title: 'SEO Optimization',
              description: 'Search engine optimization setup and configuration.',
              price: 1000,
              type: 'fixed',
              estimatedHours: 15,
              isRequired: false,
              order: 2
            }
          ]
        }
      ]
      
      return mockProposals
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const sendProposalEmail = createAsyncThunk(
  'proposals/sendEmail',
  async ({ proposal, customerEmail, customerName }, { rejectWithValue }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      console.log('WIREFRAME: Sending proposal email to:', customerEmail)
      return { success: true, messageId: `msg-${Date.now()}` }
    } catch (error) {
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