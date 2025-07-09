# Project Proposal System: Focused Implementation Plan
## Wireframe → Backend → Production

Based on the actual requirements from PROPOSAL_DEVELOPMENT_GUIDE.md

## Architecture Overview

**IMPORTANT**: The proposal system uses a **separated architecture**:

- **Admin Frontend** (this repository): Proposal creation, management, and secure link generation
- **Public Website** (separate repository): Client-facing proposal viewer at `/proposal/:token`
- **Shared Backend API**: Both applications use the same API endpoints for proposal data

This separation ensures:
- Client proposals are always public and accessible
- Website branding and analytics integration
- No authentication issues for clients
- Clear separation of admin vs. client functionality

---

## Phase 1: Wireframe the Core User Experience (Week 1)

### 1.1 Admin Interface Wireframe
**Goal**: Design the admin proposal creation experience

**Key Wireframes**:
1. **Project Details → Proposals Tab**
   - Integrate into existing [`ProjectDetails.jsx`](../src/components/projects/ProjectDetails.jsx)
   - Add "Proposals" as first tab (before Team, Objectives, etc.)
   - Show proposal status, creation date, client access link

2. **Proposal Creation Form**
   - Title and description fields
   - Request summary builder (objectives, timeline, budget)
   - Concept upload section (wireframes, mockups, videos)
   - Deliverable builder with pricing
   - Preview mode

3. **Proposal Management**
   - Send proposal to client
   - View client access link
   - Track proposal status (draft, sent, viewed, approved)

**Deliverable**: Admin wireframes showing exact UI layout and interactions

### 1.2 Client Interface Wireframe
**Goal**: Design the client proposal viewing experience

**IMPORTANT**: Client interface will be implemented on the **public website**, not in this admin frontend.

**Key Wireframes**:
1. **Proposal Landing Page** (`https://claritybusinesssolutions.ca/proposal/:token`)
   - Clean, professional layout matching website branding
   - No admin navigation - website navigation only
   - Proposal title and company branding
   - Project overview and objectives
   - Timeline and budget information

2. **Concept Gallery**
   - Display wireframes, mockups, videos
   - Lightbox viewing for detailed inspection
   - Download capabilities for assets

3. **Deliverable Selection**
   - Interactive checkboxes for optional items
   - Required items (cannot be deselected)
   - Real-time price calculation
   - Clear pricing breakdown

4. **Approval Flow**
   - Review selected deliverables
   - Contact information form
   - Single approval button
   - Confirmation message

**Deliverable**: Client wireframes for website implementation with exact user flow and interactions

---

## Phase 2: Backend Requirements from Wireframes (Week 1-2)

### 2.1 Data Model from Wireframe Requirements
**Goal**: Extract exact data needs from wireframes

**From Admin Wireframes**:
```javascript
// Proposal Creation Requirements
{
  // Basic Info
  title: "string",
  description: "text",
  projectId: "string",
  customerId: "string",
  
  // Request Summary
  requestSummary: {
    overview: "text",
    objectives: ["string"],
    timeline: "string", 
    budget: "number"
  },
  
  // Concepts (from upload section)
  concepts: [{
    title: "string",
    description: "string",
    type: "wireframe|mockup|video|document",
    fileUrl: "string",
    thumbnailUrl: "string",
    orderIndex: "number"
  }],
  
  // Deliverables (from pricing builder)
  deliverables: [{
    title: "string",
    description: "string", 
    price: "number",
    type: "fixed|hourly",
    estimatedHours: "number",
    isRequired: "boolean",
    isSelected: "boolean",
    orderIndex: "number"
  }],
  
  // System fields
  status: "draft|sent|viewed|approved|rejected",
  accessToken: "string",
  expiresAt: "datetime",
  totalPrice: "number",
  selectedPrice: "number"
}
```

**From Client Wireframes**:
```javascript
// Client Interaction Requirements
{
  // Secure access
  tokenAccess: "read-only proposal data",
  
  // Interactive selection
  deliverableSelection: "real-time price updates",
  
  // Approval data
  approvalData: {
    selectedDeliverables: ["uuid"],
    contactInfo: {
      name: "string",
      email: "string", 
      title: "string",
      phone: "string"
    },
    approvedAt: "datetime"
  }
}
```

### 2.2 API Endpoints from Wireframe Actions
**Goal**: Define exact API calls needed for each wireframe interaction

**Admin API (from admin wireframes)**:
```
POST /api/proposals                    # Create new proposal
PUT /api/proposals/:id                 # Update proposal
GET /api/proposals/project/:projectId  # Get proposals for project
POST /api/proposals/:id/concepts       # Upload concept files
DELETE /api/proposals/:id/concepts/:conceptId  # Remove concept
POST /api/proposals/:id/send           # Send to client (generate token)
```

**Client API (from client wireframes)**:
```
GET /api/proposals/view/:token         # Get proposal by token
PUT /api/proposals/view/:token/selections  # Update deliverable selections
POST /api/proposals/view/:token/approve    # Submit approval
```

**Deliverable**: Complete API specification driven by wireframe interactions

---

## Phase 3: MVP Implementation (Week 2-3)

### 3.1 Database Setup
**Goal**: Implement the exact data model from wireframes

**Supabase Tables**:
```sql
-- Main proposals table
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  request_summary JSONB,
  status TEXT DEFAULT 'draft',
  access_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  total_price DECIMAL(10,2) DEFAULT 0,
  selected_price DECIMAL(10,2) DEFAULT 0,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Concepts table
CREATE TABLE proposal_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('wireframe', 'mockup', 'video', 'document')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deliverables table  
CREATE TABLE proposal_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  type TEXT CHECK (type IN ('fixed', 'hourly')),
  estimated_hours INTEGER,
  is_required BOOLEAN DEFAULT FALSE,
  is_selected BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Test**: Verify all wireframe data can be stored and retrieved

### 3.2 Admin Interface Implementation
**Goal**: Build the exact admin interface from wireframes

**Files to Modify**:
```
src/components/projects/ProjectDetails.jsx
- Add "Proposals" tab as first tab
- Import ProjectProposalsTab component

src/components/proposals/ProjectProposalsTab.jsx (enhance existing)
- Match wireframe layout exactly
- Add concept upload functionality
- Add deliverable builder
- Add real-time pricing calculation
- Add preview mode
```

**Implementation Steps**:
1. Modify [`ProjectDetails.jsx`](../src/components/projects/ProjectDetails.jsx) to add Proposals tab
2. Enhance [`ProjectProposalsTab.jsx`](../src/components/proposals/ProjectProposalsTab.jsx) to match wireframes
3. Add missing sub-components for concept upload and deliverable building
4. Connect to Redux state management
5. Test all wireframe interactions work

**Test Criteria**:
- Admin interface matches wireframes exactly
- Can create proposals with concepts and deliverables
- Pricing calculates correctly
- Preview shows client view

### 3.3 Client Interface Implementation
**Goal**: Prepare admin frontend for website-based client interface

**IMPORTANT**: Client interface will be implemented on the **public website**, not in this admin frontend.

**Admin Frontend Responsibilities**:
- Generate secure proposal links pointing to website
- Provide API endpoints for proposal data
- Handle proposal approval processing

**Website Implementation** (separate repository):
```
website/pages/proposal/[token].jsx
- Public page for /proposal/:token route
- Website navigation and branding
- Clean, professional layout

website/components/proposals/
├── ProposalHeader.jsx
├── ProposalOverview.jsx
├── ConceptGallery.jsx
├── DeliverableSelector.jsx
└── ProposalApproval.jsx
```

**Admin Frontend Changes**:
1. Update proposal link generation to point to website
2. Ensure API endpoints support public access with tokens
3. Test proposal data retrieval via API

**Test Criteria**:
- Admin generates correct website-based proposal links
- API endpoints accessible with valid tokens
- Proposal data properly formatted for website consumption

### 3.4 Redux State Management
**Goal**: Implement state management for all wireframe interactions

**Files to Enhance**:
```
src/store/slices/proposalSlice.js (enhance existing)
- Add all admin actions from wireframes
- createProposal, updateProposal, sendProposal
- uploadConcept, removeConcept
- addDeliverable, updateDeliverable, removeDeliverable

src/store/slices/proposalViewerSlice.js (enhance existing)  
- Add all client actions from wireframes
- fetchProposalByToken
- updateDeliverableSelections
- approveProposal
```

**Test**: All wireframe interactions work through Redux

**Deliverable**: Working MVP that implements all wireframes exactly

---

## Phase 4: Email & Security Integration (Week 3-4)

### 4.1 Email Integration
**Goal**: Send professional proposal emails to clients

**Files to Enhance**:
```
src/services/proposalEmailService.js (enhance existing)
- Generate proposal email with secure link
- Use existing Mailjet service patterns
- Professional email template
```

**Email Template Requirements**:
- Clarity Business Solutions branding
- Proposal title and summary
- Secure access link (`https://claritybusinesssolutions.ca/proposal/:token`)
- Clear call-to-action
- Expiration notice

**Test**: Emails send successfully with working proposal links

### 4.2 Security Implementation
**Goal**: Secure proposal access and data protection

**Files to Enhance**:
```
src/services/proposalSecurityService.js (enhance existing)
- Generate cryptographically secure tokens
- Implement token validation
- Add access logging
- Handle token expiration
```

**Security Features**:
- Secure token generation (UUID + entropy)
- Time-based expiration (30 days default)
- Access logging for audit trail
- Token validation on every request

**Test**: Only valid, non-expired tokens can access proposals

**Deliverable**: Secure, email-enabled proposal system

---

## Phase 5: Payment & Automation (Week 4-5)

### 5.1 Stripe Payment Integration
**Goal**: Process 50% deposits on proposal approval

**Files to Create**:
```
src/services/paymentService.js
- Create Stripe payment intents
- Handle payment success/failure
- Update proposal status on payment

src/components/proposals/PaymentForm.jsx
- Stripe payment form
- Payment confirmation
```

**Payment Flow**:
1. Client approves proposal
2. System calculates 50% deposit
3. Stripe payment intent created
4. Client completes payment
5. Proposal status updated to "paid"

**Test**: Payment processing works end-to-end

### 5.2 MoA Generation & Project Creation
**Goal**: Automate project creation from approved proposals

**Files to Create**:
```
src/services/moaGenerationService.js
- Generate MoA document from proposal data
- Include only selected deliverables
- Professional document formatting

src/services/projectCreationService.js  
- Create project from approved proposal
- Transfer deliverables to project objectives
- Set project status and team assignments
```

**Automation Flow**:
1. Payment completed
2. Generate MoA with selected deliverables
3. Create project in system
4. Send confirmation email with MoA
5. Notify team of new project

**Test**: Complete automation from approval to project creation

**Deliverable**: Full automation with payment processing

---

## Phase 6: Testing & Production Deployment (Week 5-6)

### 6.1 Comprehensive Testing
**Goal**: Test all wireframe interactions and edge cases

**Testing Strategy**:
1. **Unit Tests**: All components and services
2. **Integration Tests**: Complete user flows
3. **Manual Testing**: All wireframe scenarios
4. **Security Testing**: Token validation and access control
5. **Payment Testing**: Stripe integration with test cards

**Test Scenarios**:
- Admin creates proposal → Client receives email → Client approves → Payment → Project created
- Token expiration handling
- Invalid token access attempts
- Payment failures and retries
- Email delivery failures

### 6.2 Performance Optimization
**Goal**: Fast, responsive user experience

**Optimization Tasks**:
1. Optimize concept image loading
2. Implement lazy loading for large proposals
3. Minimize bundle size for client viewer
4. Add loading states for all async operations
5. Optimize database queries

**Performance Targets**:
- Proposal viewer loads in < 3 seconds
- Real-time price calculation < 100ms
- Concept gallery smooth on all devices

### 6.3 Production Deployment
**Goal**: Deploy to production with monitoring

**Deployment Steps**:
1. Deploy database migrations to production Supabase
2. Deploy frontend to production
3. Configure production email templates
4. Set up Stripe production keys
5. Configure monitoring and error tracking

**Production Checklist**:
- All environment variables configured
- Database migrations applied
- Email templates tested
- Payment processing verified
- Security tokens working
- Monitoring enabled

**Deliverable**: Production-ready proposal system

---

## Success Criteria

### Admin Interface
- ✅ Proposals tab integrated into existing project workflow
- ✅ Can create proposals with concepts and deliverables
- ✅ Real-time pricing calculation works
- ✅ Preview mode shows exact client experience
- ✅ Can send proposals via email

### Client Interface  
- ✅ Secure token-based access works
- ✅ Professional, clean presentation
- ✅ Interactive deliverable selection
- ✅ Real-time price updates
- ✅ Approval flow captures all data

### Backend & Integration
- ✅ All data persists correctly
- ✅ Email delivery works reliably
- ✅ Payment processing functional
- ✅ MoA generation automated
- ✅ Project creation automated

### Security & Performance
- ✅ Secure token validation
- ✅ Access logging functional
- ✅ Fast loading times
- ✅ Mobile-responsive design
- ✅ Error handling robust

This focused plan implements exactly what's specified in the original proposal guide, using wireframes to drive backend requirements and avoiding unnecessary complexity.