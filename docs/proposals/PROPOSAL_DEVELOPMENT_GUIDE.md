# Project Proposal System Development Guide

## Overview

This document outlines the design and implementation plan for a comprehensive project proposal system that integrates seamlessly with the existing Clarity CRM frontend. The system enables clients to view, customize, and approve project proposals through secure, protected URLs while maintaining consistency with the current tech stack and implementation patterns.

## System Architecture

### Core Concept

The proposal system extends the existing client-project relationship by adding a proposal layer that sits between initial client contact and project creation. It provides a secure, interactive interface for clients to review project details, select deliverables, and approve projects with integrated payment processing.

### Integration Points

- **Existing Systems**: Integrates with current customer and project management workflows
- **Email System**: Leverages existing Mailjet service for proposal delivery
- **Payment Processing**: Integrates with Stripe for deposit collection
- **Authentication**: Uses secure token-based access for proposal viewing
- **Database**: Uses Supabase for proposal data storage and management

## Technical Architecture

### Frontend Components Structure

```
src/components/proposals/
├── ProposalCreationForm.jsx      # Admin interface for creating proposals
├── ProposalViewer.jsx            # Client-facing proposal display
├── ProposalSummary.jsx           # Request summarization component
├── ConceptGallery.jsx            # Asset preview gallery
├── DeliverableSelector.jsx       # Interactive deliverable selection
├── ProposalApproval.jsx          # Approval workflow component
└── ProposalEmailTemplate.jsx     # Email template component
```

### State Management (Redux Toolkit)

```
src/store/slices/
├── proposalSlice.js              # Proposal CRUD operations
├── proposalViewerSlice.js        # Client-side proposal viewing
└── proposalDeliverableSlice.js   # Deliverable management
```

### API Integration

```
src/api/
├── proposals.js                  # Proposal API endpoints using Supabase
└── proposalAuth.js              # Secure proposal access
```

### Services

```
src/services/
├── proposalService.js           # Business logic and data processing
├── proposalEmailService.js      # Email generation and sending
└── proposalSecurityService.js   # Token generation and validation
```

## Data Model

### Proposal Entity

```javascript
{
  id: "uuid",
  projectId: "string",
  customerId: "string", 
  title: "string",
  description: "string",
  status: "draft|sent|viewed|approved|rejected",
  accessToken: "string",           // Secure access token
  expiresAt: "datetime",
  createdAt: "datetime",
  updatedAt: "datetime",
  
  // Request Summary
  requestSummary: {
    overview: "string",
    objectives: ["string"],
    timeline: "string",
    budget: "number"
  },
  
  // Concepts/Assets
  concepts: [{
    id: "uuid",
    title: "string",
    description: "string",
    type: "wireframe|mockup|video|document",
    url: "string",
    thumbnailUrl: "string",
    order: "number"
  }],
  
  // Deliverables
  deliverables: [{
    id: "uuid",
    title: "string",
    description: "string",
    price: "number",
    type: "fixed|hourly",
    estimatedHours: "number",      // For hourly items
    isSelected: "boolean",
    isRequired: "boolean",         // Cannot be deselected
    order: "number"
  }],
  
  // Totals
  totalPrice: "number",
  selectedPrice: "number",
  
  // Approval
  approvedAt: "datetime",
  approvedDeliverables: ["uuid"],
  stripePaymentIntentId: "string",
  moaGenerated: "boolean"
}
```

### Supabase Database Schema

```sql
-- Main proposals table
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES projects(id),
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected')),
  access_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  request_summary JSONB,
  total_price DECIMAL(10,2) DEFAULT 0,
  selected_price DECIMAL(10,2) DEFAULT 0,
  approved_at TIMESTAMPTZ,
  approved_deliverables JSONB,
  stripe_payment_intent_id TEXT,
  moa_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal concepts/assets table
CREATE TABLE proposal_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('wireframe', 'mockup', 'video', 'document')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal deliverables table
CREATE TABLE proposal_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  type TEXT CHECK (type IN ('fixed', 'hourly')),
  estimated_hours INTEGER,
  is_selected BOOLEAN DEFAULT FALSE,
  is_required BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal access logs for security tracking
CREATE TABLE proposal_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_access_logs ENABLE ROW LEVEL SECURITY;

-- Policies for admin access (authenticated users)
CREATE POLICY "Admin can manage proposals" ON proposals
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage concepts" ON proposal_concepts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage deliverables" ON proposal_deliverables
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for public proposal viewing (token-based)
CREATE POLICY "Public can view proposals with valid token" ON proposals
  FOR SELECT USING (
    access_token IS NOT NULL
    AND expires_at > NOW()
    AND status IN ('sent', 'viewed', 'approved')
  );

CREATE POLICY "Public can view concepts for accessible proposals" ON proposal_concepts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = proposal_concepts.proposal_id
      AND proposals.access_token IS NOT NULL
      AND proposals.expires_at > NOW()
      AND proposals.status IN ('sent', 'viewed', 'approved')
    )
  );

CREATE POLICY "Public can view deliverables for accessible proposals" ON proposal_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = proposal_deliverables.proposal_id
      AND proposals.access_token IS NOT NULL
      AND proposals.expires_at > NOW()
      AND proposals.status IN ('sent', 'viewed', 'approved')
    )
  );
```

## Feature Specifications

### 1. Proposal Creation (Admin Interface)

**Location**: Integrated into existing project workflow
**Access**: Admin users only
**Integration Point**: [`ProjectDetails.jsx`](../../src/components/projects/ProjectDetails.jsx) - Add "Create Proposal" tab

#### Components

**ProposalCreationForm.jsx**
- Form for creating new proposals
- Request summary input (rich text editor)
- Concept upload and management
- Deliverable definition with pricing
- Preview functionality

#### Features
- **Request Summary Builder**: Rich text editor for project overview
- **Concept Management**: Upload wireframes, mockups, videos with preview generation
- **Deliverable Builder**: Add line items with fixed/hourly pricing
- **Preview Mode**: See proposal as client would see it
- **Save as Draft**: Save incomplete proposals
- **Send Proposal**: Generate secure link and send email

#### Implementation Pattern
```javascript
// Following existing patterns from ProjectObjectivesTab.jsx
const ProposalCreationForm = ({ project, onProposalCreate }) => {
  const dispatch = useDispatch()
  const { proposals, loading, error } = useSelector(state => state.proposals)
  
  const handleCreateProposal = useCallback(async (proposalData) => {
    await dispatch(createProposal({
      projectId: project.id,
      customerId: project._custID,
      ...proposalData
    }))
  }, [dispatch, project])
  
  // Component implementation...
}
```

### 2. Secure Proposal Access

**Security Model**: Token-based access without user authentication
**URL Pattern**: `/proposal/{token}`
**Expiration**: Configurable (default: 30 days)

#### ProposalSecurityService.js
```javascript
export class ProposalSecurityService {
  static generateSecureToken(proposalId) {
    // Generate cryptographically secure token
    // Store token-to-proposal mapping in database
    // Set expiration date
  }
  
  static validateToken(token) {
    // Verify token exists and hasn't expired
    // Return proposal data if valid
  }
  
  static revokeToken(token) {
    // Invalidate token (for security)
  }
}
```

### 3. Client-Facing Proposal Viewer

**IMPORTANT**: The client-facing proposal viewer is implemented on the **public website**, not in this admin frontend.

**Route**: `/proposal/:token` (on public website)
**Access**: Public with valid token
**Layout**: Website layout with professional branding
**Implementation**: Separate from admin frontend

#### Website Implementation
- Clean, professional presentation matching website branding
- Mobile-responsive design
- No admin navigation or controls
- Focused on proposal content only
- Integrated with website analytics and SEO

#### Features
- **Request Summary Display**: Professional presentation of project overview
- **Concept Gallery**: Interactive gallery with lightbox viewing
- **Deliverable Selection**: Interactive checkboxes with real-time pricing
- **Total Calculator**: Dynamic price updates based on selections
- **Approval Workflow**: Single-click approval process

#### Architecture Separation

**Admin Frontend (this repository)**:
- Proposal creation and management
- Secure link generation
- Admin interface only

**Public Website (separate repository)**:
- Client-facing proposal viewer
- Public route `/proposal/:token`
- Website branding and analytics
- No authentication required

#### Link Generation
The admin frontend generates secure proposal links that point to the public website:
```javascript
const generateProposalLink = (proposal) => {
  return `https://claritybusinesssolutions.ca/proposal/${proposal.access_token}`
}
```

#### API Integration
Both admin frontend and public website use the same backend API endpoints for proposal data, ensuring consistency while maintaining separation of concerns.

### 4. Interactive Deliverable Selection

**Component**: DeliverableSelector.jsx
**Features**: Real-time price calculation, required items, optional items

#### Implementation
```javascript
const DeliverableSelector = ({ deliverables, onSelectionChange }) => {
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [totalPrice, setTotalPrice] = useState(0)
  
  const handleToggleDeliverable = useCallback((deliverableId) => {
    // Update selection and recalculate total
    // Call onSelectionChange with new selection
  }, [onSelectionChange])
  
  // Real-time price calculation
  const calculatedTotal = useMemo(() => {
    return deliverables
      .filter(d => selectedItems.has(d.id))
      .reduce((sum, d) => sum + d.price, 0)
  }, [deliverables, selectedItems])
  
  // Component implementation...
}
```

### 5. Email Integration

**Service**: ProposalEmailService.js
**Template**: Based on existing [`mailjetService.js`](../../src/services/mailjetService.js) patterns
**Integration**: Extends existing Mailjet service

#### Email Template Features
- Professional Clarity Business Solutions branding
- Proposal summary
- Secure access link
- Clear call-to-action
- Mobile-responsive design

#### Implementation
```javascript
import { sendEmailWithAttachment, createHtmlEmailTemplate } from '../services/mailjetService'

export class ProposalEmailService {
  static async sendProposalEmail(proposal, customerEmail) {
    const emailContent = this.generateProposalEmailContent(proposal)
    
    return await sendEmailWithAttachment({
      to: customerEmail,
      subject: `Project Proposal: ${proposal.title}`,
      html: emailContent,
      // No attachment for proposal emails
    })
  }
  
  static generateProposalEmailContent(proposal) {
    return createHtmlEmailTemplate({
      title: `Project Proposal: ${proposal.title}`,
      mainText: `We're excited to present your project proposal. Please review the details and select your preferred deliverables.`,
      buttonText: "View Proposal",
      buttonUrl: `https://claritybusinesssolutions.ca/proposal/${proposal.access_token}`,
      footerText: "This proposal link will expire in 30 days."
    })
  }
}
```

### 6. Approval Workflow

**Component**: ProposalApproval.jsx
**Integration**: Stripe payment processing
**Workflow**: Approval → MoA Generation → Payment Link

#### Approval Process
1. Client reviews proposal and selects deliverables
2. Client clicks "Approve Proposal"
3. System generates MoA based on selected deliverables
4. System creates Stripe payment intent for 50% deposit
5. Client receives email with MoA and payment link
6. Project status updates to "Approved" upon payment

#### Implementation
```javascript
const ProposalApproval = ({ proposal, selectedDeliverables, totalPrice }) => {
  const [isApproving, setIsApproving] = useState(false)
  
  const handleApproval = useCallback(async () => {
    setIsApproving(true)
    try {
      // 1. Submit approval with selected deliverables
      await dispatch(approveProposal({
        proposalId: proposal.id,
        selectedDeliverables,
        totalPrice
      }))
      
      // 2. Generate MoA and payment link (handled by backend)
      // 3. Send confirmation email
      
    } catch (error) {
      // Handle error
    } finally {
      setIsApproving(false)
    }
  }, [dispatch, proposal, selectedDeliverables, totalPrice])
  
  // Component implementation...
}
```

### 7. MoA Generation and Payment Processing

**Backend Integration**: Extends existing backend services
**Payment**: Stripe integration for 50% deposit
**Document**: Automated MoA generation based on selected deliverables

#### Workflow
1. Proposal approval triggers MoA generation
2. MoA includes only selected deliverables
3. Stripe payment intent created for 50% of total
4. Email sent with MoA attachment and payment link
5. Payment completion triggers project creation

## Security Considerations

### Token-Based Access
- Cryptographically secure tokens (UUID v4 + additional entropy)
- Time-based expiration (configurable, default 30 days)
- Single-use tokens for sensitive operations
- Token revocation capability

### Data Protection
- No sensitive customer data in URLs
- Proposal content only accessible with valid token
- Audit logging for proposal access and modifications
- Rate limiting on proposal endpoints

### Email Security
- Secure token generation for email links
- No sensitive data in email content
- Clear expiration messaging
- Revocation capability for compromised links

## Implementation Phases

### Phase 1: Core Infrastructure
1. Supabase database schema and RLS policies
2. Basic proposal CRUD operations using existing Supabase service patterns
3. Token generation and validation
4. Basic proposal viewer

### Phase 2: Admin Interface
1. Proposal creation form
2. Concept upload and management (using Supabase Storage)
3. Deliverable builder
4. Preview functionality

### Phase 3: Client Experience
1. Enhanced proposal viewer
2. Interactive deliverable selection
3. Real-time price calculation
4. Approval workflow

### Phase 4: Integration & Automation
1. Email integration
2. MoA generation
3. Stripe payment processing
4. Project creation automation

### Phase 5: Enhancement & Polish
1. Advanced concept gallery
2. Mobile optimization
3. Analytics and tracking
4. Performance optimization

## Project Navigation Integration

### Integration with Existing Project Tabs

The proposal system integrates seamlessly into the existing project navigation structure in [`ProjectDetails.jsx`](../../src/components/projects/ProjectDetails.jsx). The current navigation order will be updated to prioritize proposals:

**New Navigation Order**: `Proposals → Team → Objectives → Tasks → Notes → Links`

### ProjectDetails.jsx Integration

#### Required Changes

1. **Import the new ProposalTab component**:
```javascript
import ProjectProposalsTab from './ProjectProposalsTab';
```

2. **Update the tabs navigation section** (lines 224-291):
```javascript
<div className="flex mb-4 border-b">
  {/* Proposals Tab - NEW FIRST TAB */}
  <button
    onClick={() => setActiveTab('proposals')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'proposals'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Proposals
    {activeTab === 'proposals' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
  
  {/* Team Tab - MOVED TO SECOND */}
  <button
    onClick={() => setActiveTab('team')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'team'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Team
    {activeTab === 'team' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
  
  {/* Objectives Tab - MOVED TO THIRD */}
  <button
    onClick={() => setActiveTab('objectives')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'objectives'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Objectives
    {activeTab === 'objectives' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
  
  {/* Tasks Tab - MOVED TO FOURTH */}
  <button
    onClick={() => setActiveTab('tasks')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'tasks'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Tasks
    {activeTab === 'tasks' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
  
  {/* Notes Tab - MOVED TO FIFTH */}
  <button
    onClick={() => setActiveTab('notes')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'notes'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Notes
    {activeTab === 'notes' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
  
  {/* Links Tab - MOVED TO SIXTH */}
  <button
    onClick={() => setActiveTab('links')}
    className={`px-4 py-2 font-medium focus:outline-none relative ${
      activeTab === 'links'
      ? `${darkMode ? 'text-white' : 'text-gray-800'}`
      : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
    }`}
  >
    Links
    {activeTab === 'links' && (
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>
    )}
  </button>
</div>
```

3. **Add Proposals tab content** in the tab content section (after line 297):
```javascript
{/* Proposals Tab - NEW */}
{activeTab === 'proposals' && project && (
  <ProjectProposalsTab
    project={project}
    darkMode={darkMode}
    localProject={localProject}
    setLocalProject={setLocalProject}
  />
)}
```

4. **Update PropTypes** to include proposal-related props:
```javascript
ProjectDetails.propTypes = {
  // ... existing props
  onProposalCreate: PropTypes.func,
  onProposalSend: PropTypes.func,
  onProposalUpdate: PropTypes.func,
  project: PropTypes.shape({
    // ... existing project props
    proposals: PropTypes.arrayOf(PropTypes.object)
  }).isRequired
};
```

### Component Structure

```
src/components/projects/
├── ProjectDetails.jsx           # Main project component (updated)
├── ProjectProposalsTab.jsx      # New proposals tab component
├── ProjectTasksTab.jsx          # Existing tasks tab
├── ProjectTeamTab.jsx           # Existing team tab  
├── ProjectObjectivesTab.jsx     # Existing objectives tab
├── ProjectNotesTab.jsx          # Existing notes tab
└── ProjectLinksTab.jsx          # Existing links tab
```

### Integration Benefits

1. **Seamless User Experience**: Proposals are now part of the natural project workflow
2. **Consistent UI/UX**: Follows existing tab patterns and styling
3. **Context Preservation**: Users stay within the project context while managing proposals
4. **Workflow Enhancement**: Proposals can directly influence project objectives and tasks
5. **Data Consistency**: Proposal data is linked to project data for better tracking

### Workflow Integration

- **Proposal Creation**: Create proposals directly from project context
- **Proposal to Project**: Convert approved proposals into project objectives and tasks
- **Status Synchronization**: Proposal status updates reflect in project status
- **Team Collaboration**: Team members can collaborate on proposals within project context

## File Structure

```
src/
├── components/proposals/
│   ├── admin/
│   │   ├── ProposalCreationForm.jsx
│   │   ├── ProposalManagement.jsx
│   │   └── ProposalPreview.jsx
│   ├── client/
│   │   ├── ProposalViewer.jsx
│   │   ├── ConceptGallery.jsx
│   │   ├── DeliverableSelector.jsx
│   │   └── ProposalApproval.jsx
│   └── shared/
│       ├── ProposalSummary.jsx
│       └── ProposalLayout.jsx
├── store/slices/
│   ├── proposalSlice.js
│   ├── proposalViewerSlice.js
│   └── proposalDeliverableSlice.js
├── services/
│   ├── proposalService.js
│   ├── proposalEmailService.js
│   └── proposalSecurityService.js
├── api/
│   ├── proposals.js
│   └── proposalAuth.js
└── pages/
    └── ProposalViewerPage.jsx
```

## Integration with Existing Systems

### Supabase Integration
- Leverage existing [`supabaseService.js`](../../src/services/supabaseService.js) patterns
- Use backend API routing through `api.claritybusinesssolutions.ca`
- Implement RLS policies for secure data access
- Utilize Supabase Storage for concept file uploads

### Project Management
- Add "Proposals" tab to [`ProjectDetails.jsx`](../../src/components/projects/ProjectDetails.jsx)
- Extend project creation workflow to include proposal approval
- Link approved proposals to created projects

### Customer Management
- Add proposal history to customer details
- Track proposal engagement metrics
- Integration with customer communication history

### Email System
- Extend existing [`mailjetService.js`](../../src/services/mailjetService.js)
- Use existing email templates and branding
- Maintain consistent email styling

### Authentication
- Proposal viewing bypasses normal authentication
- Admin proposal management uses existing auth
- Secure token validation for proposal access

## Testing Strategy

### Unit Tests
- Proposal service functions
- Token generation and validation
- Price calculation logic
- Email template generation

### Integration Tests
- Proposal creation workflow
- Email sending functionality
- Payment processing integration
- MoA generation

### End-to-End Tests
- Complete proposal workflow
- Client approval process
- Payment and project creation
- Email delivery and access

## Performance Considerations

### Optimization Strategies
- Lazy loading for concept galleries
- Memoized price calculations
- Optimized image loading and caching
- Minimal bundle size for client viewer

### Caching
- Proposal data caching
- Concept image optimization
- Token validation caching
- Email template caching

## Monitoring and Analytics

### Metrics to Track
- Proposal creation rate
- Client engagement (views, time spent)
- Approval conversion rate
- Payment completion rate
- Email delivery success

### Error Monitoring
- Token validation failures
- Payment processing errors
- Email delivery failures
- Proposal access errors

## Backend API Integration

Following the established patterns in [`DEVELOPMENT_GUIDELINES.md`](../DEVELOPMENT_GUIDELINES.md) and [`FRONTEND_AUTHENTICATION_GUIDE.md`](FRONTEND_AUTHENTICATION_GUIDE.md), the proposal system leverages the existing backend infrastructure at `https://api.claritybusinesssolutions.ca/`.

### Authentication Strategy

The proposal system uses **M2M Authentication** as defined in the Frontend Authentication Guide:
- **Format**: `Authorization: Bearer {signature}.{timestamp}`
- **Purpose**: Backend service access to `/api` endpoints
- **Implementation**: HMAC-SHA256 signed tokens
- **Environment Variable**: `SECRET_KEY` (not `VITE_SECRET_KEY` to avoid client exposure)

### Available Backend Services

1. **Supabase Operations**: `/supabase/{table}/insert`, `/supabase/{table}/select`, `/supabase/{table}/update`, `/supabase/{table}/delete`
2. **Email Services**: `/mailjet/send-email`, `/mailjet/send-template-email`, `/mailjet/send-bulk-email`
3. **Event System**: `/events/` for workflow orchestration
4. **Health Check**: `/health` for service verification

### API Client Implementation

Following the **API Client Pattern** from DEVELOPMENT_GUIDELINES.md:

#### Proposal API Service (src/api/proposals.js)

```javascript
// Following DEVELOPMENT_GUIDELINES.md API Client Pattern
class ProposalAPIClient {
  constructor() {
    this.baseUrl = 'https://api.claritybusinesssolutions.ca'
    // Note: SECRET_KEY should be server-side only, not VITE_SECRET_KEY
    this.secretKey = import.meta.env.SECRET_KEY
  }

  /**
   * Generate HMAC-SHA256 authentication header for backend API
   * Following FRONTEND_AUTHENTICATION_GUIDE.md M2M Authentication pattern
   * @param {string} payload - Request payload
   * @returns {Promise<string>} Authorization header
   */
  async generateAuthHeader(payload = '') {
    if (!this.secretKey) {
      console.warn('[Proposals] SECRET_KEY not available. Using development mode.')
      const timestamp = Math.floor(Date.now() / 1000)
      return `Bearer dev-token.${timestamp}`
    }
    
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `${timestamp}.${payload}`
    
    try {
      const encoder = new TextEncoder()
      const keyData = encoder.encode(this.secretKey)
      const messageData = encoder.encode(message)
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      return `Bearer ${signatureHex}.${timestamp}`
    } catch (error) {
      console.warn('[Proposals] Crypto operation failed, using fallback:', error)
      const timestamp = Math.floor(Date.now() / 1000)
      return `Bearer fallback-token.${timestamp}`
    }
  }

  /**
   * Make authenticated API request
   * Following DEVELOPMENT_GUIDELINES.md error handling patterns
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const payload = options.body || ''
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': await this.generateAuthHeader(payload),
        ...options.headers
      },
      ...options
    }
    
    try {
      const response = await fetch(url, config)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('[Proposals] API request failed:', error)
      throw error
    }
  }

  // HTTP method helpers following DEVELOPMENT_GUIDELINES.md patterns
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })

### Redux Toolkit Integration

Following the **State Management Best Practices** from DEVELOPMENT_GUIDELINES.md, the proposal system uses Redux Toolkit for ALL shared/global state management:

#### Proposal Redux Slice (src/store/slices/proposalSlice.js)

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { proposalAPIClient } from '../../api/proposals'

// Async thunks for ALL API operations (required by DEVELOPMENT_GUIDELINES.md)
export const createProposal = createAsyncThunk(
  'proposals/createProposal',
  async (proposalData, { rejectWithValue }) => {
    try {
      const response = await proposalAPIClient.post('/supabase/proposals/insert', {
        data: {
          ...proposalData,
          access_token: generateSecureToken(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'draft'
        }
      })
      return response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchProposalByToken = createAsyncThunk(
  'proposals/fetchProposalByToken',
  async (token, { rejectWithValue }) => {
    try {
      // Fetch main proposal
      const proposalResponse = await proposalAPIClient.get('/supabase/proposals/select', {
        params: { filters: JSON.stringify({ access_token: token }) }
      })
      
      if (!proposalResponse || proposalResponse.length === 0) {
        throw new Error('Proposal not found or expired')
      }
      
      const proposal = proposalResponse[0]
      
      // Fetch related data in parallel
      const [conceptsResponse, deliverablesResponse] = await Promise.all([
        proposalAPIClient.get('/supabase/proposal_concepts/select', {
          params: { filters: JSON.stringify({ proposal_id: proposal.id }) }
        }),
        proposalAPIClient.get('/supabase/proposal_deliverables/select', {
          params: { filters: JSON.stringify({ proposal_id: proposal.id }) }
        })
      ])
      
      return {
        ...proposal,
        concepts: conceptsResponse || [],
        deliverables: deliverablesResponse || []
      }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const sendProposalEmail = createAsyncThunk(
  'proposals/sendProposalEmail',
  async ({ proposal, customerEmail, customerName }, { rejectWithValue }) => {
    try {
      const emailData = {
        from_email: {
          email: "noreply@claritybusinesssolutions.ca",
          name: "Clarity Business Solutions"
        },
        to: [{ email: customerEmail, name: customerName }],
        subject: `Project Proposal: ${proposal.title}`,
        html_part: generateProposalEmailHTML(proposal),
        text_part: generateProposalEmailText(proposal)
      }
      
      const response = await proposalAPIClient.post('/mailjet/send-email', emailData)
      return response
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const approveProposal = createAsyncThunk(
  'proposals/approveProposal',
  async ({ proposalId, selectedDeliverables, totalPrice }, { rejectWithValue }) => {
    try {
      // Update proposal status
      await proposalAPIClient.put(`/supabase/proposals/update`, {
        data: { status: 'approved', selected_price: totalPrice },
        filters: { id: proposalId }
      })
      
      // Update deliverable selections
      const updatePromises = selectedDeliverables.map(deliverableId =>
        proposalAPIClient.put('/supabase/proposal_deliverables/update', {
          data: { is_selected: true },
          filters: { id: deliverableId }
        })
      )
      
      await Promise.all(updatePromises)
      
      // Trigger workflow event
      await proposalAPIClient.post('/events/', {
        event_type: 'proposal_approved',
        data: { proposal_id: proposalId, selected_deliverables: selectedDeliverables }
      })
      
      return { proposalId, selectedDeliverables, totalPrice }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

// Redux slice following DEVELOPMENT_GUIDELINES.md patterns
const proposalSlice = createSlice({
  name: 'proposals',
  initialState: {
    // Admin state
    proposals: [],
    currentProposal: null,
    
    // Client viewer state
    viewerProposal: null,
    selectedDeliverables: [],
    totalPrice: 0,
    
    // Loading states
    loading: false,
    creating: false,
    sending: false,
    approving: false,
    
    // Error handling
    error: null,
    emailError: null,
    approvalError: null
  },
  reducers: {
    // Local UI state management only
    clearError: (state) => {
      state.error = null
      state.emailError = null
      state.approvalError = null
    },
    
    toggleDeliverable: (state, action) => {
      const deliverableId = action.payload
      const index = state.selectedDeliverables.indexOf(deliverableId)
      
      if (index > -1) {
        state.selectedDeliverables.splice(index, 1)
      } else {
        state.selectedDeliverables.push(deliverableId)
      }
      
      // Recalculate total price
      if (state.viewerProposal?.deliverables) {
        state.totalPrice = state.viewerProposal.deliverables
          .filter(d => state.selectedDeliverables.includes(d.id))
          .reduce((sum, d) => sum + parseFloat(d.price), 0)
      }
    },
    
    resetViewer: (state) => {
      state.viewerProposal = null
      state.selectedDeliverables = []
      state.totalPrice = 0
    }
  },
  extraReducers: (builder) => {
    builder
      // Create proposal
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
      
      // Fetch proposal by token
      .addCase(fetchProposalByToken.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProposalByToken.fulfilled, (state, action) => {
        state.loading = false
        state.viewerProposal = action.payload
        // Initialize with all deliverables selected
        state.selectedDeliverables = action.payload.deliverables?.map(d => d.id) || []
        state.totalPrice = action.payload.deliverables?.reduce((sum, d) => sum + parseFloat(d.price), 0) || 0
      })
      .addCase(fetchProposalByToken.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Send proposal email
      .addCase(sendProposalEmail.pending, (state) => {
        state.sending = true
        state.emailError = null
      })
      .addCase(sendProposalEmail.fulfilled, (state) => {
        state.sending = false
      })
      .addCase(sendProposalEmail.rejected, (state, action) => {
        state.sending = false
        state.emailError = action.payload
      })
      
      // Approve proposal
      .addCase(approveProposal.pending, (state) => {
        state.approving = true
        state.approvalError = null
      })
      .addCase(approveProposal.fulfilled, (state, action) => {
        state.approving = false
        if (state.viewerProposal) {
          state.viewerProposal.status = 'approved'
          state.viewerProposal.selected_price = action.payload.totalPrice
        }
      })
      .addCase(approveProposal.rejected, (state, action) => {
        state.approving = false
        state.approvalError = action.payload
      })
  }
})

export const { clearError, toggleDeliverable, resetViewer } = proposalSlice.actions
export default proposalSlice.reducer

// Selectors for component usage
export const selectProposals = (state) => state.proposals.proposals
export const selectCurrentProposal = (state) => state.proposals.currentProposal
export const selectViewerProposal = (state) => state.proposals.viewerProposal
export const selectSelectedDeliverables = (state) => state.proposals.selectedDeliverables
export const selectTotalPrice = (state) => state.proposals.totalPrice
export const selectProposalLoading = (state) => state.proposals.loading
export const selectProposalError = (state) => state.proposals.error

/**
 * Generate secure access token
 * @returns {string} Secure token
 */
function generateSecureToken() {
  return crypto.randomUUID() + '-' + Date.now().toString(36)
}

/**
 * Generate HTML email content for proposal
 * @param {Object} proposal - Proposal data
 * @returns {string} HTML email content
 */
function generateProposalEmailHTML(proposal) {
  const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Project Proposal: ${proposal.title}</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .email-header {
          background-color: #004967;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .email-content {
          padding: 20px;
        }
        .cta-button {
          background-color: #004967;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          display: inline-block;
          margin: 20px 0;
        }
        .email-footer {
          background-color: #f5f5f5;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1 style="margin: 0; font-size: 24px;">Project Proposal</h1>
        </div>
        <div class="email-content">
          <h2>Hello!</h2>
          <p>We're excited to present your project proposal for <strong>${proposal.title}</strong>.</p>
          <p>Please review the details, select your preferred deliverables, and let us know if you'd like to proceed.</p>
          
          <div style="text-align: center;">
            <a href="${proposalUrl}" class="cta-button">View Proposal</a>
          </div>
          
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br>The Clarity Business Solutions Team</p>
        </div>
        <div class="email-footer">
          <p>This proposal link will expire in 30 days.</p>
          <p>&copy; ${new Date().getFullYear()} Clarity Business Solutions. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate text email content for proposal
 * @param {Object} proposal - Proposal data
 * @returns {string} Text email content
 */
function generateProposalEmailText(proposal) {
  const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
  
  return `
Project Proposal: ${proposal.title}

Hello!

We're excited to present your project proposal for ${proposal.title}.

Please review the details, select your preferred deliverables, and let us know if you'd like to proceed.

View your proposal here: ${proposalUrl}

If you have any questions, please don't hesitate to reach out.

Best regards,
The Clarity Business Solutions Team

---
This proposal link will expire in 30 days.
© ${new Date().getFullYear()} Clarity Business Solutions. All rights reserved.
  `
}
```

#### Component Usage Example

Following DEVELOPMENT_GUIDELINES.md component patterns:

```javascript
import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import {
  fetchProposalByToken,
  toggleDeliverable,
  approveProposal,
  selectViewerProposal,
  selectSelectedDeliverables,
  selectTotalPrice,
  selectProposalLoading
} from '../store/slices/proposalSlice'

const ProposalContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: ${props => props.theme.spacing.lg};
`

/**
 * Proposal viewer component for clients
 * @param {Object} props - Component props
 * @param {string} props.token - Proposal access token
 */
const ProposalViewer = ({ token }) => {
  const dispatch = useDispatch()
  const proposal = useSelector(selectViewerProposal)
  const selectedDeliverables = useSelector(selectSelectedDeliverables)
  const totalPrice = useSelector(selectTotalPrice)
  const loading = useSelector(selectProposalLoading)
  
  useEffect(() => {
    if (token) {
      dispatch(fetchProposalByToken(token))
    }
  }, [dispatch, token])
  
  const handleDeliverableToggle = useCallback((deliverableId) => {
    dispatch(toggleDeliverable(deliverableId))
  }, [dispatch])
  
  const handleApproval = useCallback(() => {
    dispatch(approveProposal({
      proposalId: proposal.id,
      selectedDeliverables,
      totalPrice
    }))
  }, [dispatch, proposal?.id, selectedDeliverables, totalPrice])
  
  if (loading) {
    return <div>Loading proposal...</div>
  }
  
  if (!proposal) {
    return <div>Proposal not found</div>
  }
  
  return (
    <ProposalContainer>
      <h1>{proposal.title}</h1>
      {/* Proposal content */}
    </ProposalContainer>
  )
}

ProposalViewer.propTypes = {
  token: PropTypes.string.isRequired
}

export default ProposalViewer
```

  }
  
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
  
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }
  
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }
}

// Create singleton instance following DEVELOPMENT_GUIDELINES.md patterns
const proposalAPIClient = new ProposalAPIClient()

/**
 * Create a new proposal using backend Supabase API
 * @param {Object} proposalData - Proposal data
 * @returns {Promise<Object>} Created proposal
 */
export async function createProposal(proposalData) {
  const proposalWithToken = {
    ...proposalData,
    access_token: generateSecureToken(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'draft'
  }
  
  const payload = JSON.stringify({ data: proposalWithToken })
  
  try {
    const response = await axios.post(
      `${backendConfig.baseUrl}/supabase/proposals/insert`,
      { data: proposalWithToken },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await generateBackendAuthHeader(payload)
        }
      }
    )
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Create proposal error:', error)
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    }
  }
}

/**
 * Fetch proposal by access token using backend API
 * @param {string} token - Access token
 * @returns {Promise<Object>} Proposal with related data
 */
export async function fetchProposalByToken(token) {
  try {
    // Fetch main proposal
    const proposalResponse = await axios.get(
      `${backendConfig.baseUrl}/supabase/proposals/select`,
      {
        params: {
          filters: JSON.stringify({ access_token: token })
        },
        headers: {
          'Authorization': await generateBackendAuthHeader()
        }
      }
    )
    
    if (!proposalResponse.data || proposalResponse.data.length === 0) {
      return { success: false, error: 'Proposal not found or expired' }
    }
    
    const proposal = proposalResponse.data[0]
    
    // Fetch related data in parallel
    const [conceptsResponse, deliverablesResponse] = await Promise.all([
      axios.get(
        `${backendConfig.baseUrl}/supabase/proposal_concepts/select`,
        {
          params: {
            filters: JSON.stringify({ proposal_id: proposal.id })
          },
          headers: {
            'Authorization': await generateBackendAuthHeader()
          }
        }
      ),
      axios.get(
        `${backendConfig.baseUrl}/supabase/proposal_deliverables/select`,
        {
          params: {
            filters: JSON.stringify({ proposal_id: proposal.id })
          },
          headers: {
            'Authorization': await generateBackendAuthHeader()
          }
        }
      )
    ])
    
    return {
      success: true,
      data: {
        ...proposal,
        concepts: conceptsResponse.data || [],
        deliverables: deliverablesResponse.data || []
      }
    }
  } catch (error) {
    console.error('[Proposals] Fetch proposal error:', error)
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    }
  }
}

/**
 * Send proposal email using backend Mailjet API
 * @param {Object} proposal - Proposal data
 * @param {string} customerEmail - Customer email address
 * @param {string} customerName - Customer name
 * @returns {Promise<Object>} Email send result
 */
export async function sendProposalEmail(proposal, customerEmail, customerName) {
  const emailData = {
    from_email: {
      email: "noreply@claritybusinesssolutions.ca",
      name: "Clarity Business Solutions"
    },
    to: [{
      email: customerEmail,
      name: customerName
    }],
    subject: `Project Proposal: ${proposal.title}`,
    html_part: generateProposalEmailHTML(proposal),
    text_part: generateProposalEmailText(proposal)
  }
  
  try {
    const response = await axios.post(
      `${backendConfig.baseUrl}/mailjet/send-email`,
      emailData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await generateBackendAuthHeader(JSON.stringify(emailData))
        }
      }
    )
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Send email error:', error)
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    }
  }
}

/**
 * Generate HTML email content for proposal
 * @param {Object} proposal - Proposal data
 * @returns {string} HTML email content
 */
function generateProposalEmailHTML(proposal) {
  const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Project Proposal: ${proposal.title}</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .email-header {
          background-color: #004967;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .email-content {
          padding: 20px;
        }
        .cta-button {
          background-color: #004967;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          display: inline-block;
          margin: 20px 0;
        }
        .email-footer {
          background-color: #f5f5f5;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1 style="margin: 0; font-size: 24px;">Project Proposal</h1>
        </div>
        <div class="email-content">
          <h2>Hello!</h2>
          <p>We're excited to present your project proposal for <strong>${proposal.title}</strong>.</p>
          <p>Please review the details, select your preferred deliverables, and let us know if you'd like to proceed.</p>
          
          <div style="text-align: center;">
            <a href="${proposalUrl}" class="cta-button">View Proposal</a>
          </div>
          
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br>The Clarity Business Solutions Team</p>
        </div>
        <div class="email-footer">
          <p>This proposal link will expire in 30 days.</p>
          <p>&copy; ${new Date().getFullYear()} Clarity Business Solutions. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate text email content for proposal
 * @param {Object} proposal - Proposal data
 * @returns {string} Text email content
 */
function generateProposalEmailText(proposal) {
  const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
  
  return `
Project Proposal: ${proposal.title}

Hello!

We're excited to present your project proposal for ${proposal.title}.

Please review the details, select your preferred deliverables, and let us know if you'd like to proceed.

View your proposal here: ${proposalUrl}

If you have any questions, please don't hesitate to reach out.

Best regards,
The Clarity Business Solutions Team

---
This proposal link will expire in 30 days.
© ${new Date().getFullYear()} Clarity Business Solutions. All rights reserved.
  `
}

/**
 * Generate secure access token
 * @returns {string} Secure token
 */
function generateSecureToken() {
  return crypto.randomUUID() + '-' + Date.now().toString(36)
}
```

### Enhanced Email Integration

The backend provides comprehensive Mailjet integration with multiple endpoints:

- **`/mailjet/send-email`**: Direct email sending with HTML/text content
- **`/mailjet/send-template-email`**: Template-based emails
- **`/mailjet/send-bulk-email`**: Bulk email operations

This allows the proposal system to:
1. Send professional proposal notification emails
2. Send approval confirmation emails
3. Send MoA and payment link emails
4. Track email delivery status

### Workflow Integration

The backend's event system (`/events/`) can be leveraged for:
- **Proposal approval workflows**: Trigger MoA generation and payment processing
- **Email automation**: Schedule follow-up emails
- **Integration triggers**: Connect with external systems (Stripe, document generation)

### Authentication & Security

The backend uses HMAC-SHA256 Bearer token authentication, which provides:
- **Secure API access**: Cryptographically signed requests
- **Timestamp validation**: Prevents replay attacks
- **Consistent security**: Same auth pattern across all backend services

### Redux Slice Implementation

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as proposalAPI from '../api/proposals'

// Async thunks
export const fetchProposalByToken = createAsyncThunk(
  'proposalViewer/fetchByToken',
  async (token, { rejectWithValue }) => {
    try {
      const result = await proposalAPI.fetchProposalByToken(token)
      if (!result.success) {
        return rejectWithValue(result.error)
      }
      return result.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateDeliverableSelections = createAsyncThunk(
  'proposalViewer/updateSelections',
  async ({ proposalId, selectedIds }, { rejectWithValue }) => {
    try {
      const result = await proposalAPI.updateProposalSelections(proposalId, selectedIds)
      if (!result.success) {
        return rejectWithValue(result.error)
      }
      return { selectedIds, proposalId }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

const proposalViewerSlice = createSlice({
  name: 'proposalViewer',
  initialState: {
    proposal: null,
    loading: false,
    error: null,
    selectedDeliverables: new Set()
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    toggleDeliverable: (state, action) => {
      const deliverableId = action.payload
      if (state.selectedDeliverables.has(deliverableId)) {
        state.selectedDeliverables.delete(deliverableId)
      } else {
        state.selectedDeliverables.add(deliverableId)
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProposalByToken.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProposalByToken.fulfilled, (state, action) => {
        state.loading = false
        state.proposal = action.payload
        // Initialize selected deliverables
        state.selectedDeliverables = new Set(
          action.payload.deliverables
            .filter(d => d.is_selected || d.is_required)
            .map(d => d.id)
        )
      })
      .addCase(fetchProposalByToken.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError, toggleDeliverable } = proposalViewerSlice.actions
export default proposalViewerSlice.reducer
```

### Advanced Backend Leveraging

#### Event-Driven Architecture

The proposal system can leverage the backend's event system for sophisticated workflows:

```javascript
/**
 * Trigger proposal approval workflow
 * @param {string} proposalId - Proposal ID
 * @param {Array} selectedDeliverables - Selected deliverables
 * @returns {Promise<Object>} Workflow result
 */
export async function triggerProposalApprovalWorkflow(proposalId, selectedDeliverables) {
  const eventData = {
    event_type: 'proposal_approved',
    data: {
      proposal_id: proposalId,
      selected_deliverables: selectedDeliverables,
      timestamp: new Date().toISOString()
    }
  }
  
  try {
    const response = await axios.post(
      `${backendConfig.baseUrl}/events/`,
      eventData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await generateBackendAuthHeader(JSON.stringify(eventData))
        }
      }
    )
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Workflow trigger error:', error)
    return { success: false, error: error.message }
  }
}
```

#### Template-Based Email System

Leverage the backend's template email capabilities:

```javascript
/**
 * Send template-based proposal email
 * @param {Object} proposal - Proposal data
 * @param {string} customerEmail - Customer email
 * @param {string} templateId - Mailjet template ID
 * @returns {Promise<Object>} Email result
 */
export async function sendTemplateProposalEmail(proposal, customerEmail, templateId) {
  const templateData = {
    template_id: templateId,
    to: [{
      email: customerEmail,
      name: proposal.customer_name
    }],
    variables: {
      proposal_title: proposal.title,
      proposal_url: `${window.location.origin}/proposal/${proposal.access_token}`,
      company_name: "Clarity Business Solutions",
      expiry_date: new Date(proposal.expires_at).toLocaleDateString()
    }
  }
  
  try {
    const response = await axios.post(
      `${backendConfig.baseUrl}/mailjet/send-template-email`,
      templateData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await generateBackendAuthHeader(JSON.stringify(templateData))
        }
      }
    )
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Template email error:', error)
    return { success: false, error: error.message }
  }
}
```

#### Bulk Operations

For multiple proposals or batch operations:

```javascript
/**
 * Send bulk proposal emails
 * @param {Array} proposals - Array of proposals with customer data
 * @returns {Promise<Object>} Bulk email result
 */
export async function sendBulkProposalEmails(proposals) {
  const bulkData = {
    emails: proposals.map(proposal => ({
      to: [{
        email: proposal.customer_email,
        name: proposal.customer_name
      }],
      subject: `Project Proposal: ${proposal.title}`,
      html_part: generateProposalEmailHTML(proposal),
      variables: {
        proposal_title: proposal.title,
        proposal_url: `${window.location.origin}/proposal/${proposal.access_token}`
      }
    }))
  }
  
  try {
    const response = await axios.post(
      `${backendConfig.baseUrl}/mailjet/send-bulk-email`,
      bulkData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await generateBackendAuthHeader(JSON.stringify(bulkData))
        }
      }
    )
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error('[Proposals] Bulk email error:', error)
    return { success: false, error: error.message }
  }
}
```

## Conclusion

This proposal system design maintains consistency with the existing Clarity CRM architecture while providing a professional, secure, and user-friendly experience for clients. The backend-integrated approach leverages the comprehensive API infrastructure at `api.claritybusinesssolutions.ca`, ensuring seamless integration with current workflows.

### Key Advantages of Backend Integration:

1. **Unified Authentication**: HMAC-SHA256 Bearer token system across all services
2. **Comprehensive Email Services**: Multiple Mailjet endpoints for different email needs
3. **Event-Driven Workflows**: Sophisticated automation through the events system
4. **Supabase Integration**: Direct database operations through standardized endpoints
5. **Security & Monitoring**: Built-in authentication, validation, and error handling
6. **Scalability**: Backend handles complex operations, reducing frontend complexity

### Integration Benefits:

- **Consistent API Patterns**: All proposal operations follow the same authentication and request patterns
- **Centralized Email Management**: Professional email templates and delivery tracking
- **Workflow Automation**: Event-driven approval processes and follow-up actions
- **Security**: Cryptographically signed requests with timestamp validation
- **Monitoring**: Centralized logging and error handling through the backend
- **Future Extensibility**: Easy integration with additional services and workflows

The system seamlessly integrates with current workflows, extends existing services, and provides a robust foundation for enhanced client engagement and project approval processes while maintaining the high security and reliability standards of the existing infrastructure.