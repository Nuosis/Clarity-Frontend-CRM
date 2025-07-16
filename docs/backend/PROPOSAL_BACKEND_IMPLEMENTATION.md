# Proposal System Backend Implementation

## Status
Frontend wireframe is **100% complete**. All components, Redux state management, and UI flows implemented. Backend implementation required.

## Architecture Overview

**Admin Frontend**: Proposal creation/management (this repo)
**Public Website**: Client proposal viewer at `/proposal/:token` with M2M auth
**Backend API**: `https://api.claritybusinesssolutions.ca/api/proposals/`

## Database Schema

```sql
-- Core proposals table
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES projects(id),
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected')),
    access_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    request_summary JSONB DEFAULT '{}',
    total_price DECIMAL(10,2) DEFAULT 0,
    selected_price DECIMAL(10,2) DEFAULT 0,
    approved_at TIMESTAMPTZ,
    approved_deliverables JSONB DEFAULT '[]',
    stripe_payment_intent_id TEXT,
    moa_generated BOOLEAN DEFAULT FALSE,
    moa_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Concept files (images/videos)
CREATE TABLE proposal_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Deliverable options
CREATE TABLE proposal_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);
```

## Required API Endpoints

### Admin Endpoints (Supabase Auth)
```
POST   /api/proposals/                    # Create proposal
GET    /api/proposals/                    # List proposals
GET    /api/proposals/{id}                # Get proposal
PUT    /api/proposals/{id}                # Update proposal
DELETE /api/proposals/{id}                # Delete proposal
POST   /api/proposals/{id}/send           # Send to client
POST   /api/proposals/{id}/concepts       # Upload concept files
DELETE /api/proposals/concepts/{id}       # Delete concept
```

### Public Endpoints (M2M Auth)
```
GET    /api/proposals/token/{token}       # Get proposal by token
POST   /api/proposals/token/{token}/approve # Approve proposal
POST   /api/proposals/token/{token}/view  # Track view
```

## Integration Requirements

### Email Service
- Use existing Mailjet integration
- Send proposal links to clients
- Approval notifications to admin

### File Storage
- Use Supabase Storage for concept files
- Generate signed URLs for public access

### Payment Processing
- Stripe integration for approved proposals
- Create payment intents on approval

### Document Generation
- PDF MoA generation on approval
- Store in Supabase Storage

## Authentication

**Admin**: Existing Supabase auth pattern
**Public Website**: M2M HMAC-SHA256 auth (existing pattern)

## Frontend Integration Points

**Mock API Client**: [`src/api/proposals.js`](../../src/api/proposals.js)
**Redux Slices**: [`src/store/slices/proposalSlice.js`](../../src/store/slices/proposalSlice.js), [`src/store/slices/proposalViewerSlice.js`](../../src/store/slices/proposalViewerSlice.js)

Replace mock implementations with real API calls using existing patterns.

## Public Website Implementation

Add route `/proposal/:token` to public website:
- Use M2M auth for backend API calls
- Display proposal content with website branding
- Handle deliverable selection and approval
- Redirect to Stripe for payment

## Event System Integration

Use existing `/events/` system for:
- Proposal sent notifications
- View tracking
- Approval workflows
- Payment confirmations

## Implementation Priority

1. Database schema and core CRUD endpoints
2. Token-based public access
3. Email integration
4. File upload/storage
5. Payment processing
6. Document generation

Frontend is ready - implement backend endpoints to match existing mock API contracts.