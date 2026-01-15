# QuickBooks Backend Integration Workflows

This document visualizes the key workflows for integrating the Clarity CRM frontend with the new backend QuickBooks API infrastructure.

## Table of Contents

1. [OAuth Connection Flow](#oauth-connection-flow)
2. [Invoice Creation from Financial Records](#invoice-creation-from-financial-records)
3. [Financial Record Synchronization](#financial-record-synchronization)
4. [Connection Status Check](#connection-status-check)
5. [Admin Configuration Flow](#admin-configuration-flow)

---

## OAuth Connection Flow

**User Action**: Connect to QuickBooks

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant QuickBooks

    User->>Frontend: Click "Connect to QuickBooks"
    Frontend->>Backend: GET /quickbooks/authorize (HMAC auth)
    Backend->>Backend: Generate OAuth state token
    Backend->>Backend: Store state in quickbooks_tokens
    Backend-->>Frontend: Return authorization URL + state
    Frontend->>QuickBooks: Redirect to QuickBooks OAuth page
    QuickBooks->>User: Show authorization prompt
    User->>QuickBooks: Approve connection
    QuickBooks->>Frontend: Redirect to callback URL (code, state, realmId)
    Frontend->>Backend: POST /quickbooks/oauth/callback (code, state, realmId)
    Backend->>Backend: Validate state token (CSRF protection)
    Backend->>QuickBooks: Exchange code for access/refresh tokens
    QuickBooks-->>Backend: Return tokens (access_token, refresh_token, expires_in)
    Backend->>Backend: Store tokens in quickbooks_tokens table
    Backend->>Backend: Create default config in organization_quickbooks_config
    Backend-->>Frontend: Return success (connection established)
    Frontend->>Frontend: Update UI - show "Connected" status
    Frontend->>User: Show success message with company name
```

**Key Points**:
- HMAC authentication used for all backend requests
- Backend handles token storage (frontend never sees raw tokens)
- CSRF protection via state token validation
- Default QuickBooks config created automatically on first connection
- Frontend displays connection status and company name

---

## Invoice Creation from Financial Records

**User Action**: Generate QuickBooks invoice from unbilled financial records

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Supabase
    participant QuickBooks

    User->>Frontend: Select customer in CustomerSalesTable
    Frontend->>Backend: GET /quickbooks/unbilled-records?customer_id=X (HMAC auth)
    Backend->>Supabase: SELECT * FROM customer_sales WHERE customer_id=X AND is_billed=false
    Supabase-->>Backend: Return unbilled records
    Backend-->>Frontend: Return unbilled records
    Frontend->>Frontend: Display unbilled records to user
    User->>Frontend: Click "Generate Invoice"
    Frontend->>Backend: POST /quickbooks/invoices/from-records (record_ids, options)
    Backend->>Supabase: SELECT config FROM organization_quickbooks_config
    Supabase-->>Backend: Return tax codes, item IDs, invoice format
    Backend->>Backend: Generate invoice payload using config
    Backend->>QuickBooks: POST /v3/company/{realmId}/invoice
    QuickBooks-->>Backend: Return created invoice (invoice_id, doc_number, total)
    Backend->>Supabase: UPDATE customer_sales SET is_billed=true, quickbooks_invoice_id=X
    Supabase-->>Backend: Confirm update (triggers set billed_at timestamp)
    Backend-->>Frontend: Return invoice details
    Frontend->>Frontend: Update UI - remove billed records from unbilled list
    Frontend->>User: Show success message (invoice number, total)

    opt Email Invoice
        User->>Frontend: Click "Email Invoice"
        Frontend->>Backend: POST /quickbooks/send-invoice/{invoice_id}?sendTo=email
        Backend->>QuickBooks: POST /v3/company/{realmId}/invoice/{id}/send
        QuickBooks-->>Backend: Return email sent confirmation
        Backend-->>Frontend: Return success
        Frontend->>User: Show "Invoice emailed" confirmation
    end
```

**Key Points**:
- Backend generates invoice payload using organization-specific config (tax codes, item IDs)
- customer_sales.is_billed updated automatically after successful invoice creation
- Triggers set billed_at and quickbooks_synced_at timestamps
- Optional email delivery integrated in same flow
- Frontend shows real-time status and invoice details

---

## Financial Record Synchronization

**User Action**: Sync QuickBooks invoices with customer_sales table

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Supabase
    participant QuickBooks

    User->>Frontend: Click "Sync QuickBooks"
    Frontend->>Backend: POST /quickbooks/sync-invoices (HMAC auth)
    Backend->>Supabase: SELECT * FROM customer_sales WHERE is_billed=true AND quickbooks_invoice_id IS NULL
    Supabase-->>Backend: Return records missing QB invoice ID

    loop For each customer with unbilled records
        Backend->>QuickBooks: GET /v3/company/{realmId}/invoice?customer_id=X
        QuickBooks-->>Backend: Return customer invoices
        Backend->>Backend: Match invoices to customer_sales by date/amount
        Backend->>Supabase: UPDATE customer_sales SET quickbooks_invoice_id=X WHERE matched
        Supabase-->>Backend: Confirm update
    end

    Backend->>Backend: Generate sync summary (matched, unmatched, errors)
    Backend-->>Frontend: Return sync summary
    Frontend->>Frontend: Update UI with sync results
    Frontend->>User: Show sync summary (X records synced, Y errors)

    opt Show Errors
        User->>Frontend: Click "View Errors"
        Frontend->>Frontend: Display error details modal
    end
```

**Key Points**:
- Syncs customer_sales records with QuickBooks invoices
- Matches invoices by customer ID, date range, and amount
- Updates quickbooks_invoice_id for matched records
- Returns summary with matched/unmatched/error counts
- Frontend displays progress and final results

---

## Connection Status Check

**System Action**: Periodic check of QuickBooks connection health

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Supabase

    Frontend->>Backend: GET /quickbooks/status (HMAC auth)
    Backend->>Supabase: SELECT is_active, expires_at, company_name FROM quickbooks_tokens WHERE organization_id=X
    Supabase-->>Backend: Return token status

    alt Token valid and active
        Backend-->>Frontend: Return { connected: true, company_name, expires_at }
        Frontend->>Frontend: Display "Connected to [company_name]"
        Frontend->>Frontend: Show token expiration status
    else Token expired but refresh token valid
        Backend->>Backend: Attempt token refresh
        Backend-->>Frontend: Return { connected: true, refreshed: true }
        Frontend->>Frontend: Display "Connected (token refreshed)"
    else No connection or refresh failed
        Backend-->>Frontend: Return { connected: false, reason }
        Frontend->>Frontend: Display "Not connected" + reconnect button
    end
```

**Key Points**:
- Frontend calls periodically (e.g., on page load, every 10 minutes)
- Backend checks token expiration and validity
- Automatic token refresh if expired but refresh token valid
- Frontend displays connection status in UI
- No raw tokens exposed to frontend (security)

---

## Admin Configuration Flow

**User Action**: Configure QuickBooks account mappings (admin only)

```mermaid
sequenceDiagram
    participant Admin
    participant Frontend
    participant Backend
    participant Supabase

    Admin->>Frontend: Navigate to QuickBooks Settings
    Frontend->>Frontend: Verify user role = admin (RLS policy check)
    Frontend->>Backend: GET /api/organizations/{org_id}/quickbooks/config (HMAC auth)
    Backend->>Supabase: SELECT * FROM organization_quickbooks_config WHERE organization_id=X
    Supabase-->>Backend: Return current config
    Backend-->>Frontend: Return config (tax codes, item IDs, format)
    Frontend->>Frontend: Display config form with current values

    Admin->>Frontend: Update config values (tax codes, item IDs, etc.)
    Admin->>Frontend: Click "Save Configuration"
    Frontend->>Frontend: Validate input (required fields, format)
    Frontend->>Backend: PUT /api/organizations/{org_id}/quickbooks/config (new config)
    Backend->>Backend: Validate config (tax codes > 0, item IDs exist in QB)

    alt Validation passes
        Backend->>Supabase: UPDATE organization_quickbooks_config SET ... WHERE organization_id=X
        Supabase-->>Backend: Confirm update (trigger sets updated_at)
        Backend-->>Frontend: Return success
        Frontend->>Frontend: Update UI with new config
        Frontend->>Admin: Show "Configuration saved" success message
    else Validation fails
        Backend-->>Frontend: Return validation errors
        Frontend->>Frontend: Display error messages on form
        Frontend->>Admin: Show "Please fix errors" message
    end
```

**Key Points**:
- Admin-only access enforced by RLS policies
- Configuration affects invoice generation (tax codes, item IDs)
- Backend validates config before saving
- Frontend shows current values and allows updates
- Changes take effect immediately for new invoices

---

## Error Handling Workflows

### Token Refresh Failure

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant QuickBooks

    Frontend->>Backend: POST /quickbooks/invoices/from-records
    Backend->>Backend: Check token expiration
    Backend->>QuickBooks: POST /oauth2/v1/tokens/refresh (refresh_token)
    QuickBooks-->>Backend: Error: Invalid refresh token
    Backend->>Backend: Mark connection inactive (is_active=false)
    Backend-->>Frontend: Return { error: "QuickBooks connection expired", code: "AUTH_EXPIRED" }
    Frontend->>Frontend: Display error + "Reconnect" button
    Frontend->>User: "QuickBooks connection expired. Please reconnect."
```

### Invoice Creation Failure

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant QuickBooks

    Frontend->>Backend: POST /quickbooks/invoices/from-records
    Backend->>QuickBooks: POST /v3/company/{realmId}/invoice
    QuickBooks-->>Backend: Error: Customer not found (QB Error 610)
    Backend-->>Frontend: Return { error: "Customer not found in QuickBooks", code: "QB_ERROR_610" }
    Frontend->>Frontend: Display error message
    Frontend->>User: "Customer not found. Create customer in QuickBooks first."
    Frontend->>User: Show "Create QB Customer" button
```

---

## State Machine: QuickBooks Connection Status

```mermaid
stateDiagram-v2
    [*] --> Disconnected

    Disconnected --> Connecting : User clicks "Connect"
    Connecting --> OAuthPending : Authorization URL generated
    OAuthPending --> Connected : OAuth callback success
    OAuthPending --> Disconnected : OAuth callback failure

    Connected --> TokenExpiringSoon : Token expires in <24h
    TokenExpiringSoon --> Connected : Token refresh success
    TokenExpiringSoon --> Disconnected : Token refresh failure

    Connected --> Disconnected : User clicks "Disconnect"
    Connected --> Disconnected : Refresh token expires

    Connected --> Syncing : User triggers sync
    Syncing --> Connected : Sync complete
    Syncing --> Connected : Sync failed (connection still active)
```

**State Descriptions**:
- **Disconnected**: No QuickBooks connection, show "Connect" button
- **Connecting**: OAuth flow initiated, waiting for user authorization
- **OAuthPending**: User redirected to QuickBooks, waiting for callback
- **Connected**: Active connection with valid tokens, show company name
- **TokenExpiringSoon**: Connection valid but token expires <24h, show warning
- **Syncing**: Sync operation in progress, show spinner
- **Disconnected**: Connection lost or manually disconnected, show "Reconnect" button

---

## Data Flow Diagram

```mermaid
graph TD
    subgraph Frontend
        UI[User Interface]
        API[QuickBooks API Client]
        Hooks[React Hooks]
    end

    subgraph Backend
        Auth[HMAC Auth Middleware]
        QB_Routes[QuickBooks Routes]
        DB_Service[Database Service]
    end

    subgraph Supabase
        Tokens[quickbooks_tokens]
        Config[organization_quickbooks_config]
        Sales[customer_sales]
    end

    subgraph QuickBooks
        OAuth[OAuth Server]
        QB_API[QuickBooks API]
    end

    UI -->|User actions| Hooks
    Hooks -->|Data requests| API
    API -->|HMAC auth requests| Auth
    Auth -->|Validated requests| QB_Routes
    QB_Routes -->|CRUD operations| DB_Service
    DB_Service -->|Read/Write| Tokens
    DB_Service -->|Read/Write| Config
    DB_Service -->|Read/Write| Sales
    QB_Routes -->|OAuth flow| OAuth
    QB_Routes -->|API calls| QB_API
    OAuth -->|Tokens| QB_Routes
    QB_API -->|Invoice data| QB_Routes
    QB_Routes -->|Response data| API
    API -->|Update state| Hooks
    Hooks -->|Render updates| UI
```

---

## Testing Workflow

```mermaid
graph LR
    A[Write Code] --> B[Unit Tests]
    B --> C{Tests Pass?}
    C -->|No| A
    C -->|Yes| D[Integration Tests]
    D --> E{Tests Pass?}
    E -->|No| A
    E -->|Yes| F[E2E Tests]
    F --> G{Tests Pass?}
    G -->|No| A
    G -->|Yes| H[Deploy to Staging]
    H --> I[Manual QA]
    I --> J{QA Pass?}
    J -->|No| A
    J -->|Yes| K[Deploy to Production]
```

**Test Levels**:
1. **Unit Tests**: Individual function tests (API client, utils)
2. **Integration Tests**: Multi-component interactions (API + hooks + UI)
3. **E2E Tests**: Complete user workflows (OAuth flow, invoice creation)
4. **Manual QA**: User acceptance testing in staging environment
5. **Production**: Monitored deployment with rollback plan

---

## Deployment Workflow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant CI as CI/CD
    participant Staging
    participant Prod as Production

    Dev->>GH: Push code to feature branch
    GH->>CI: Trigger build and test
    CI->>CI: Run unit tests
    CI->>CI: Run integration tests
    CI->>CI: Build production bundle

    alt Tests fail
        CI-->>Dev: Notify failure
        Dev->>Dev: Fix issues
        Dev->>GH: Push fixes
    else Tests pass
        CI-->>GH: Mark as passing
        Dev->>GH: Create pull request
        GH->>Dev: Code review
        Dev->>GH: Merge to main
        GH->>CI: Trigger staging deployment
        CI->>Staging: Deploy to staging
        Staging->>Dev: Manual QA testing

        alt QA fails
            Dev->>Dev: Fix issues
            Dev->>GH: Push hotfix
        else QA passes
            Dev->>CI: Approve production deploy
            CI->>Prod: Deploy to production
            Prod->>CI: Monitor metrics
            CI->>Dev: Notify deployment success
        end
    end
```

---

## Rollback Workflow

```mermaid
graph TD
    A[Production Issue Detected] --> B{Severity?}
    B -->|Critical| C[Immediate Rollback]
    B -->|Medium| D[Investigate]
    B -->|Low| E[Schedule Fix]

    C --> F[Revert to Previous Version]
    F --> G[Redeploy Previous Build]
    G --> H[Verify Production]
    H --> I{Issue Resolved?}
    I -->|Yes| J[Post-Mortem Analysis]
    I -->|No| K[Escalate to Team]

    D --> L{Can Fix Forward?}
    L -->|Yes| M[Deploy Hotfix]
    L -->|No| C

    M --> H
    E --> N[Create Bug Ticket]
```

**Rollback Criteria**:
- **Critical**: System down, data corruption, security breach → Immediate rollback
- **Medium**: Feature broken, high error rate → Investigate, then decide
- **Low**: UI bug, minor issue → Schedule fix for next release

---

## Summary

These workflows provide a comprehensive view of:
- **User Journeys**: OAuth connection, invoice generation, sync operations
- **System Interactions**: Frontend ↔ Backend ↔ Supabase ↔ QuickBooks
- **State Management**: Connection status state machine
- **Data Flow**: Request/response patterns and data persistence
- **Testing Strategy**: Unit → Integration → E2E → Manual QA
- **Deployment Process**: Development → Staging → Production
- **Error Handling**: Token refresh failures, invoice creation errors
- **Rollback Procedures**: Production issue response

All workflows follow the same pattern:
1. User initiates action in frontend
2. Frontend calls backend API with HMAC authentication
3. Backend processes request (database operations, QuickBooks API calls)
4. Backend returns response to frontend
5. Frontend updates UI and shows user feedback

This ensures consistent, secure, and testable integration across all QuickBooks operations.
