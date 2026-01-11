# QuickBooks API Contracts Specification

**Document Version:** 1.0.0
**Date:** 2026-01-10
**Status:** Backend Change Request - Awaiting Approval

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Requirements](#authentication-requirements)
3. [API Endpoints](#api-endpoints)
   - [OAuth & Initialization](#oauth--initialization)
   - [Customer Management](#customer-management)
   - [Invoice Operations](#invoice-operations)
   - [Reference Data](#reference-data)
   - [Testing & Utilities](#testing--utilities)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Business Logic Rules](#business-logic-rules)

---

## Overview

This document specifies the backend API contracts required for QuickBooks Online (QBO) integration with Clarity CRM. These endpoints handle OAuth authentication, customer synchronization, invoice generation, and financial data management.

**Base URL:** `https://api.claritybusinesssolutions.ca/quickbooks`

**Current Implementation Status:**
- ✅ All endpoints are **currently implemented and working** in production
- This document serves as a **specification reference** for the QuickBooks migration requirements
- No new backend changes are required at this time
- Frontend code references these endpoints via `src/api/quickbooksApi.js`

**Reference Documentation:**
- Complete endpoint reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md`
- Frontend implementation: `src/api/quickbooksApi.js` (lines 1-610)
- Integration guide: `.devflow/tasks/tasks-migration-requirements/QUICKBOOKS_INTEGRATION.md`

---

## Authentication Requirements

### HMAC-SHA256 Authentication

All QuickBooks API endpoints require HMAC-SHA256 signature-based authentication.

**Authentication Header Format:**
```
Authorization: Bearer {signature}.{timestamp}
```

**Algorithm:**
```javascript
// Generate HMAC signature
const timestamp = Math.floor(Date.now() / 1000);
const payload = (method !== 'GET' && data) ? JSON.stringify(data) : '';
const message = `${timestamp}.${payload}`;
const signature = HMAC-SHA256(secretKey, message);
const authHeader = `Bearer ${signature}.${timestamp}`;
```

**Token Validity:** 5 minutes from timestamp

**Required Headers:**
```http
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {organization-uuid}
Content-Type: application/json
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (lines 31-60)
- Function: `generateAuthHeader(payload)`
- Environment Variables:
  - `VITE_SECRET_KEY` - HMAC signing secret
  - `VITE_CLARITY_INTEGRATION_ORG_ID` - Organization context
  - `VITE_API_URL` - Backend API base URL

---

## API Endpoints

### OAuth & Initialization

#### 1. Initialize OAuth Flow

**Endpoint:** `GET /quickbooks/authorize`
**Purpose:** Start QuickBooks OAuth authorization flow
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/authorize?organization_id={org_id}
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization_id` | string (UUID) | No | Organization ID override (uses header if omitted) |

**Response:** `200 OK`
```json
{
  "authorization_url": "https://appcenter.intuit.com/connect/oauth2?...",
  "state": "random-state-token"
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 195)
- Function: `getQBOAuthorizationUrl()`

---

#### 2. Handle OAuth Callback

**Endpoint:** `POST /quickbooks/oauth/callback`
**Purpose:** Exchange authorization code for access tokens
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/oauth/callback
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "code": "authorization-code-from-qb",
  "state": "state-token",
  "realmId": "quickbooks-company-id"
}
```

**Request Body:**
```typescript
interface OAuthCallbackRequest {
  code: string;          // Authorization code from QuickBooks
  state: string;         // CSRF validation token
  realmId?: string;      // QuickBooks company ID (optional)
}
```

**Response:** `200 OK`
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400,
  "realm_id": "123456789"
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 206)
- Function: `handleQBOOAuthCallback(code, state, realmId)`

---

#### 3. Refresh Access Token

**Endpoint:** `POST /quickbooks/token/refresh`
**Purpose:** Refresh expired QuickBooks access token
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/token/refresh
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{}
```

**Response:** `200 OK`
```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 218)
- Function: `refreshQBOToken()`

---

#### 4. Validate Credentials

**Endpoint:** `POST /quickbooks/validate`
**Purpose:** Test QuickBooks connection and credentials
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/validate
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{}
```

**Response:** `200 OK`
```json
{
  "is_valid": true
}
```

**Error Response:** `200 OK`
```json
{
  "is_valid": false,
  "error": "Token expired or invalid"
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 226)
- Function: `validateQBOCredentials()`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 134-158)
- Status: Endpoint confirmed working as of 2025-08-03

---

### Customer Management

#### 5. List Customers

**Endpoint:** `GET /quickbooks/customers`
**Purpose:** Retrieve all customers from QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/customers?active_only=true&max_results=100
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `active_only` | boolean | No | `true` | Return only active customers |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "customers": [
    {
      "Id": "42",
      "SyncToken": "3",
      "DisplayName": "Select Janitorial Inc.",
      "CompanyName": "Select Janitorial",
      "FullyQualifiedName": "Select Janitorial Inc.",
      "Active": true,
      "Taxable": true,
      "Balance": 321013.74,
      "BalanceWithJobs": 321013.74,
      "CurrencyRef": {
        "value": "CAD",
        "name": "Canadian Dollar"
      },
      "DefaultTaxCodeRef": {
        "value": "4"
      },
      "PrimaryEmailAddr": {
        "Address": "contact@selectjanitorial.com"
      },
      "PrimaryPhone": {
        "FreeFormNumber": "(555) 555-5555"
      },
      "MetaData": {
        "CreateTime": "2024-01-08T11:53:38-08:00",
        "LastUpdatedTime": "2025-08-01T23:23:29-07:00"
      }
    }
  ]
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 251)
- Function: `listQBOCustomers(params)`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 292-367)
- Status: Returns 58+ customers with full metadata as of 2025-08-03

---

#### 6. Search Customers

**Endpoint:** `GET /quickbooks/customers/search`
**Purpose:** Search customers by name or email
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/customers/search?name=MacSpec&active_only=true
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | - | Partial name match (searches CompanyName, DisplayName, GivenName, FamilyName) |
| `email` | string | No | - | Partial email match |
| `active_only` | boolean | No | `true` | Return only active customers |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "customers": [
    {
      "Id": "140",
      "DisplayName": "MacSpec Inc.",
      "CompanyName": "MacSpec Inc.",
      "PrimaryEmailAddr": {
        "Address": "carol@macspecinc.com"
      },
      "CurrencyRef": {
        "value": "USD",
        "name": "United States Dollar"
      },
      "Balance": 3380.92
    }
  ]
}
```

**Search Implementation Notes:**
- Uses cascading search: CompanyName → DisplayName → GivenName
- Avoids complex SQL OR conditions for QB API compatibility
- Each field searched sequentially until results found

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 302)
- Function: `searchQBOCustomers(params)`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 636-694)
- Status: Returns accurate partial matches as of 2025-08-03

---

#### 7. Create Customer

**Endpoint:** `POST /quickbooks/customers`
**Purpose:** Create new customer in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/customers
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "DisplayName": "Sureguard",
  "CompanyName": "Sureguard",
  "FullyQualifiedName": "Sureguard",
  "GivenName": "Jake",
  "FamilyName": "Parrick",
  "Title": "Mr",
  "PrimaryEmailAddr": {
    "Address": "lee@sureguard.us"
  },
  "PrimaryPhone": {
    "FreeFormNumber": "(555) 555-5555"
  },
  "CurrencyRef": {
    "name": "United States Dollar",
    "value": "USD"
  }
}
```

**Request Body Schema:**
```typescript
interface CustomerCreateRequest {
  DisplayName: string;                    // Required - How customer appears in QB
  CompanyName?: string;                   // Optional - Company name
  FullyQualifiedName?: string;            // Optional - Full name path
  GivenName?: string;                     // Optional - First name
  FamilyName?: string;                    // Optional - Last name
  Title?: string;                         // Optional - Mr/Mrs/Ms/Dr
  PrimaryEmailAddr?: {                    // Optional - Primary email
    Address: string;
  };
  PrimaryPhone?: {                        // Optional - Primary phone
    FreeFormNumber: string;
  };
  CurrencyRef: {                          // Required - Currency setting
    name: string;                         // Currency full name
    value: string;                        // Currency code (CAD/USD/EUR/GBP/AUD)
  };
  BillAddr?: {                            // Optional - Billing address
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;      // State/Province code
    PostalCode?: string;
    Country?: string;
  };
}
```

**Response:** `201 Created`
```json
{
  "customer": {
    "Id": "487",
    "SyncToken": "0",
    "DisplayName": "Sureguard",
    "CompanyName": "Sureguard",
    "FullyQualifiedName": "Sureguard",
    "GivenName": "Jake",
    "FamilyName": "Parrick",
    "Active": true,
    "Taxable": true,
    "Balance": 0,
    "BalanceWithJobs": 0,
    "CurrencyRef": {
      "name": "United States Dollar",
      "value": "USD"
    },
    "PrimaryEmailAddr": {
      "Address": "lee@sureguard.us"
    },
    "PrimaryPhone": {
      "FreeFormNumber": "(555) 555-5555"
    },
    "MetaData": {
      "CreateTime": "2025-08-03T10:15:23-07:00",
      "LastUpdatedTime": "2025-08-03T10:15:23-07:00"
    }
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 271)
- Function: `createQBOCustomer(customerData)`
- UI Component: `src/components/financial/CreateQBOCustomerModal.jsx`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 369-468)
- Status: Successfully creates customers with full contact info as of 2025-08-03

---

#### 8. Get Customer by ID

**Endpoint:** `GET /quickbooks/customers/{customer_id}`
**Purpose:** Retrieve specific customer details
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/customers/140
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:** `200 OK`
```json
{
  "customer": {
    "Id": "140",
    "SyncToken": "2",
    "DisplayName": "MacSpec Inc.",
    "CompanyName": "MacSpec Inc.",
    "Balance": 3380.92,
    "CurrencyRef": {
      "value": "USD",
      "name": "United States Dollar"
    }
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 262)
- Function: `getQBOCustomer(customerId)`

---

#### 9. Update Customer

**Endpoint:** `PUT /quickbooks/customers`
**Purpose:** Update existing customer in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
PUT /quickbooks/customers
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "Id": "487",
  "SyncToken": "0",
  "DisplayName": "Sureguard LLC",
  "CompanyName": "Sureguard LLC",
  "PrimaryEmailAddr": {
    "Address": "contact@sureguard.us"
  }
}
```

**Request Body Requirements:**
- `Id` (required) - QuickBooks customer ID
- `SyncToken` (required) - Current sync token (prevents conflicts)
- Other fields as needed for update

**Response:** `200 OK`
```json
{
  "customer": {
    "Id": "487",
    "SyncToken": "1",
    "DisplayName": "Sureguard LLC",
    "CompanyName": "Sureguard LLC"
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 280)
- Function: `updateQBOCustomer(customerData)`

---

#### 10. Delete Customer

**Endpoint:** `DELETE /quickbooks/customers/{customer_id}`
**Purpose:** Deactivate customer in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
DELETE /quickbooks/customers/487?sync_token=1
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_id` | string | Yes | QuickBooks customer ID (path parameter) |
| `sync_token` | string | Yes | Current sync token (query parameter) |

**Response:** `200 OK`
```json
{
  "customer": {
    "Id": "487",
    "Active": false,
    "SyncToken": "2"
  }
}
```

**Note:** QuickBooks does not permanently delete customers; they are marked inactive.

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 289)
- Function: `deleteQBOCustomer(customerId, syncToken)`

---

### Invoice Operations

#### 11. List Invoices

**Endpoint:** `GET /quickbooks/invoices`
**Purpose:** Retrieve invoices from QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/invoices?customer_id=140&max_results=100
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customer_id` | string | No | - | Filter invoices by customer ID |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "Id": "6188",
      "SyncToken": "0",
      "DocNumber": "202506061",
      "TxnDate": "2025-06-30",
      "DueDate": "2025-07-30",
      "TotalAmt": 682.5,
      "Balance": 682.5,
      "CustomerRef": {
        "value": "140",
        "name": "MacSpec Inc."
      },
      "CurrencyRef": {
        "value": "USD",
        "name": "United States Dollar"
      },
      "EmailStatus": "EmailSent",
      "Line": [
        {
          "Id": "1",
          "LineNum": 1,
          "Description": "McBride",
          "Amount": 682.5,
          "DetailType": "SalesItemLineDetail",
          "SalesItemLineDetail": {
            "ItemRef": {
              "value": "7",
              "name": "Development USD"
            },
            "UnitPrice": 75,
            "Qty": 9.1,
            "TaxCodeRef": {
              "value": "3"
            }
          }
        }
      ]
    }
  ]
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 323)
- Function: `listQBOInvoices(params)`

---

#### 12. Search Invoices

**Endpoint:** `GET /quickbooks/invoices/search`
**Purpose:** Search invoices by customer and date range
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/invoices/search?customer_id=140&date_from=2025-06-01&date_to=2025-06-30
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customer_id` | string | No | - | Filter by QuickBooks customer ID |
| `date_from` | string | No | - | Start date (YYYY-MM-DD format) |
| `date_to` | string | No | - | End date (YYYY-MM-DD format) |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** See List Invoices response format

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 513)
- Function: `getQBOInvoiceByQuery(query)` (Note: search functionality uses query endpoint)

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 720-851)
- Status: Returns accurate date-filtered results as of 2025-08-03

---

#### 13. Create Invoice

**Endpoint:** `POST /quickbooks/invoices`
**Purpose:** Create new invoice in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/invoices
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "BillEmail": {
    "Address": "carol@macspecinc.com"
  },
  "CurrencyRef": {
    "name": "United States Dollar",
    "value": "USD"
  },
  "CustomerRef": {
    "name": "MacSpec Inc.",
    "value": "140"
  },
  "DeliveryInfo": {
    "DeliveryType": "Email"
  },
  "DocNumber": "140250601",
  "DueDate": "2025-07-31",
  "GlobalTaxCalculation": "TaxExcluded",
  "Line": [
    {
      "Amount": 682.50,
      "Description": "MI:McBride",
      "DetailType": "SalesItemLineDetail",
      "LineNum": 1,
      "SalesItemLineDetail": {
        "ItemRef": {
          "name": "Development USD",
          "value": "7"
        },
        "Qty": 9.1,
        "TaxCodeRef": {
          "value": "3"
        },
        "UnitPrice": 75.00
      }
    }
  ]
}
```

**Request Body Schema:**
```typescript
interface InvoiceCreateRequest {
  BillEmail: {
    Address: string;                      // Customer email for invoice delivery
  };
  CurrencyRef: {
    name: string;                         // Currency full name
    value: string;                        // Currency code (CAD/USD/EUR/GBP/AUD)
  };
  CustomerRef: {
    name: string;                         // Customer display name
    value: string;                        // QuickBooks customer ID
  };
  DeliveryInfo: {
    DeliveryType: string;                 // "Email" for email delivery
  };
  DocNumber: string;                      // Invoice number (format: qboIDYYMMNNN)
  DueDate: string;                        // Due date (YYYY-MM-DD format)
  GlobalTaxCalculation: string;           // "TaxExcluded" for separate tax calculation
  Line: Array<{
    Amount: number;                       // Line item total (Qty * UnitPrice)
    Description: string;                  // Product description
    DetailType: string;                   // Always "SalesItemLineDetail"
    LineNum: number;                      // Line number (1-indexed)
    SalesItemLineDetail: {
      ItemRef: {
        name: string;                     // Item name from QB
        value: string;                    // Item ID from QB
      };
      Qty: number;                        // Quantity (hours for time tracking)
      TaxCodeRef: {
        value: string;                    // Tax code (3=non-CAD, 4=CAD)
      };
      UnitPrice: number;                  // Price per unit
    };
  }>;
}
```

**Business Rules for Invoice Creation:**

1. **Document Number Format:** `{qboCustomerId}{YY}{MM}{NNN}`
   - Example: `140250601` = Customer 140, June 2025, Invoice #1
   - Implementation: `src/services/invoiceGenerationService.js` (lines 87-107)

2. **Tax Code Determination:**
   - CAD currency → Tax Code `4` (includes HST/GST)
   - USD/EUR/GBP/AUD → Tax Code `3` (tax exempt)
   - Implementation: `src/services/invoiceGenerationService.js` (lines 178-190)

3. **Due Date Calculation:** Net 30 (End of Month)
   - Formula: Invoice Date + 30 days, then end of that month
   - Example: Jan 10 + 30 days = Feb 9 → EOM = Feb 28
   - Implementation: `src/services/invoiceGenerationService.js` (lines 210-226)

4. **Item Reference Mapping by Currency:**
   ```javascript
   CAD: { name: 'Development CAD', value: '3' }
   USD: { name: 'Development USD', value: '7' }
   EUR: { name: 'Development EUR', value: '8' }
   ```
   - Implementation: `src/services/invoiceGenerationService.js` (lines 192-208)

5. **Line Item Description Format:** `{CustomerCaps}:{ProjectFirstWord}`
   - Example: "MacSpec Inc." + "McBride System" → "MI:McBride"
   - Extracts only capital letters and numbers from customer name
   - Implementation: `src/services/invoiceGenerationService.js` (lines 290-315)

6. **Line Item Grouping:**
   - Groups by product name and unit price
   - Consolidates quantities
   - Implementation: `src/services/invoiceGenerationService.js` (lines 228-288)

**Response:** `201 Created`
```json
{
  "invoice": {
    "Id": "6188",
    "SyncToken": "0",
    "DocNumber": "140250601",
    "TxnDate": "2025-06-01",
    "DueDate": "2025-07-31",
    "TotalAmt": 682.50,
    "Balance": 682.50,
    "CustomerRef": {
      "value": "140",
      "name": "MacSpec Inc."
    },
    "EmailStatus": "NotSet",
    "Line": [...]
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 343)
- Function: `createQBOInvoice(invoiceData)`
- Service: `src/services/invoiceGenerationService.js` (line 26: `generateInvoicePayload()`)
- UI Component: `src/components/financial/CustomerSalesTable.jsx`

**Invoice Generation Flow:**
1. User filters uninvoiced records in `CustomerSalesTable`
2. Clicks "Generate QBO Invoice" button
3. `invoiceGenerationService.generateInvoicePayload()` creates payload
4. `quickbooksApi.createQBOInvoice()` sends to backend
5. Backend creates invoice in QuickBooks
6. Frontend updates `customer_sales.inv_id` in Supabase
7. Frontend updates `devRecords.f_billed = 1` in FileMaker

**Reference:**
- Integration guide: `.devflow/tasks/tasks-migration-requirements/QUICKBOOKS_INTEGRATION.md` (lines 1-1647)

---

#### 14. Get Invoice by ID

**Endpoint:** `GET /quickbooks/invoices/{invoice_id}`
**Purpose:** Retrieve specific invoice details
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/invoices/6188
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:** `200 OK`
```json
{
  "invoice": {
    "Id": "6188",
    "SyncToken": "0",
    "DocNumber": "140250601",
    "TotalAmt": 682.50,
    "Line": [...]
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 334)
- Function: `getQBOInvoice(invoiceId)`

---

#### 15. Update Invoice

**Endpoint:** `PUT /quickbooks/invoices`
**Purpose:** Update existing invoice in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
PUT /quickbooks/invoices
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "Id": "6188",
  "SyncToken": "0",
  "Line": [...],
  "CustomerRef": {...}
}
```

**Request Body Requirements:**
- `Id` (required) - QuickBooks invoice ID
- `SyncToken` (required) - Current sync token
- Other fields as needed for update

**Response:** `200 OK`
```json
{
  "invoice": {
    "Id": "6188",
    "SyncToken": "1",
    "DocNumber": "140250601"
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 352)
- Function: `updateQBOInvoice(invoiceData)`

---

#### 16. Delete Invoice

**Endpoint:** `DELETE /quickbooks/invoices/{invoice_id}`
**Purpose:** Void invoice in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
DELETE /quickbooks/invoices/6188?sync_token=0
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice_id` | string | Yes | QuickBooks invoice ID (path parameter) |
| `sync_token` | string | Yes | Current sync token (query parameter) |

**Response:** `200 OK`
```json
{
  "invoice": {
    "Id": "6188",
    "SyncToken": "1",
    "Status": "Voided"
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 361)
- Function: `deleteQBOInvoice(invoiceId, syncToken)`

---

#### 17. Send Invoice Email

**Endpoint:** `POST /quickbooks/send-invoice/{invoice_id}`
**Purpose:** Send invoice email via QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/send-invoice/6188?sendTo=carol@macspecinc.com
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice_id` | string | Yes | QuickBooks invoice ID (path parameter) |
| `sendTo` | string | No | Override customer's default email (query parameter) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Invoice email sent successfully",
  "invoice_id": "6188",
  "email_status": "EmailSent"
}
```

**Error Responses:**
- `400 Bad Request` - Invoice not found or invalid
- `404 Not Found` - Invoice ID doesn't exist
- `422 Validation Error` - Missing required fields (customer email)

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 548)
- Function: `sendQBOInvoiceEmail(invoiceId, sendToEmail)`

---

### Reference Data

#### 18. List Items

**Endpoint:** `GET /quickbooks/items`
**Purpose:** Retrieve items for invoice line items
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/items?active_only=true&max_results=100
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `active_only` | boolean | No | `true` | Return only active items |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "items": [
    {
      "Id": "7",
      "Name": "Development USD",
      "Description": "Development services - USD",
      "Active": true,
      "Type": "Service",
      "UnitPrice": 75,
      "Taxable": false,
      "IncomeAccountRef": {
        "value": "79",
        "name": "Development Income"
      },
      "SyncToken": "1"
    },
    {
      "Id": "3",
      "Name": "Development CAD",
      "Description": "Development services - CAD",
      "Active": true,
      "Type": "Service",
      "UnitPrice": 150,
      "Taxable": true,
      "IncomeAccountRef": {
        "value": "79",
        "name": "Development Income"
      },
      "SyncToken": "1"
    }
  ]
}
```

**Common Item IDs:**
- `3` - Development CAD
- `7` - Development USD
- `8` - Development EUR

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 425)
- Function: `listQBOItems(params)`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 194-236)
- Status: Returns comprehensive item list as of 2025-08-03

---

#### 19. List Vendors

**Endpoint:** `GET /quickbooks/vendors`
**Purpose:** Retrieve vendors for bill creation
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/vendors?active_only=true&max_results=100
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `active_only` | boolean | No | `true` | Return only active vendors |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "vendors": [
    {
      "Id": "359",
      "DisplayName": "2033082 Alberta Ltd.",
      "CompanyName": "2033082 Alberta Ltd.",
      "Active": true,
      "Balance": 0,
      "CurrencyRef": {
        "value": "CAD",
        "name": "Canadian Dollar"
      },
      "PrimaryEmailAddr": {
        "Address": "kc.consulting@shaw.ca"
      },
      "SyncToken": "3"
    }
  ]
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 440)
- Function: `listQBOVendors(params)`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 239-283)
- Status: Returns vendor list with full metadata as of 2025-08-03

---

#### 20. Get Company Info

**Endpoint:** `GET /quickbooks/company-info`
**Purpose:** Retrieve QuickBooks company information
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/company-info
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:** `200 OK`
```json
{
  "company_info": {
    "CompanyName": "Clarity Business Solutions",
    "LegalName": "Clarity Business Solutions Inc.",
    "CompanyAddr": {
      "Line1": "123 Main Street",
      "City": "Victoria",
      "CountrySubDivisionCode": "BC",
      "PostalCode": "V8V 1A1",
      "Country": "Canada"
    },
    "Email": {
      "Address": "info@claritybusinesssolutions.ca"
    },
    "Country": "CA",
    "FiscalYearStartMonth": "January"
  }
}
```

**Response when not connected:** `200 OK`
```json
{
  "company_info": {}
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 238)
- Function: `getQBOCompanyInfo()`

**Verification:**
- Reference: `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (lines 168-190)
- Status: Empty object indicates no QB connection but endpoint working

---

### Testing & Utilities

#### 21. Execute Query

**Endpoint:** `POST /quickbooks/query`
**Purpose:** Execute custom SQL-like query against QuickBooks
**Status:** ✅ Working in production (use with caution)

**Request:**
```http
POST /quickbooks/query
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "query": "SELECT * FROM Customer WHERE Active = true MAXRESULTS 5"
}
```

**Request Body:**
```typescript
interface QueryRequest {
  query: string;    // QuickBooks SQL-like query
}
```

**Response:** `200 OK`
```json
{
  "results": [
    {
      "Id": "42",
      "DisplayName": "Select Janitorial Inc."
    }
  ]
}
```

**Supported Query Syntax:**
- `SELECT * FROM {Entity} WHERE {Condition} MAXRESULTS {N}`
- Entities: Customer, Invoice, Item, Vendor, Bill
- Conditions: Standard SQL WHERE clause syntax
- **Note:** Complex OR conditions can cause QB API parsing errors

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 455)
- Function: `executeQBOQuery(query)`

**Recommendation:** Use dedicated search endpoints instead of raw queries for reliability.

---

#### 22. Get Webhook Stats

**Endpoint:** `GET /webhooks/quickbooks/stats`
**Purpose:** Retrieve QuickBooks webhook statistics
**Status:** ✅ Working in production

**Request:**
```http
GET /webhooks/quickbooks/stats
Authorization: Bearer {signature}.{timestamp}
```

**Response:** `200 OK`
```json
{
  "total_events": 1234,
  "events_by_type": {
    "Customer.Create": 45,
    "Customer.Update": 123,
    "Invoice.Create": 234,
    "Invoice.Update": 345,
    "Payment.Create": 56
  },
  "last_event_time": "2025-08-03T10:15:23Z"
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 467)
- Function: `getQBOWebhookStats()`

---

#### 23. List Webhook Events

**Endpoint:** `GET /webhooks/quickbooks/list`
**Purpose:** List all stored QuickBooks webhook events
**Status:** ✅ Working in production

**Request:**
```http
GET /webhooks/quickbooks/list
Authorization: Bearer {signature}.{timestamp}
```

**Response:** `200 OK`
```json
{
  "events": [
    {
      "event_id": "uuid-1234",
      "event_type": "Customer.Create",
      "entity_id": "487",
      "timestamp": "2025-08-03T10:15:23Z",
      "realm_id": "123456789"
    }
  ]
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 475)
- Function: `listQBOWebhookEvents()`

---

#### 24. Test Webhook

**Endpoint:** `POST /webhooks/quickbooks/test`
**Purpose:** Send test webhook event
**Status:** ✅ Working in production

**Request:**
```http
POST /webhooks/quickbooks/test
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{
  "event_type": "Customer.Create",
  "entity_id": "487"
}
```

**Request Body:**
```typescript
interface TestWebhookRequest {
  event_type: string;    // Event type (Customer.Create, Invoice.Create, etc.)
  entity_id: string;     // QuickBooks entity ID
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Test webhook event sent",
  "event_id": "uuid-1234"
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 484)
- Function: `testQBOWebhook(testData)`

---

#### 25. Clear Webhook Events

**Endpoint:** `POST /webhooks/quickbooks/clear`
**Purpose:** Clear all stored webhook events
**Status:** ✅ Working in production

**Request:**
```http
POST /webhooks/quickbooks/clear
Authorization: Bearer {signature}.{timestamp}
Content-Type: application/json

{}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "events_cleared": 1234
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 492)
- Function: `clearQBOWebhookEvents()`

---

### Bill Operations

#### 26. List Bills

**Endpoint:** `GET /quickbooks/bills`
**Purpose:** Retrieve bills from QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/bills?vendor_id=359&max_results=100
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `vendor_id` | string | No | - | Filter bills by vendor ID |
| `max_results` | integer | No | `100` | Maximum number of results |

**Response:** `200 OK`
```json
{
  "bills": [
    {
      "Id": "123",
      "SyncToken": "0",
      "DocNumber": "BILL-001",
      "TxnDate": "2025-08-01",
      "DueDate": "2025-08-31",
      "TotalAmt": 500.00,
      "Balance": 500.00,
      "VendorRef": {
        "value": "359",
        "name": "2033082 Alberta Ltd."
      }
    }
  ]
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 374)
- Function: `listQBOBills(params)`

---

#### 27. Create Bill

**Endpoint:** `POST /quickbooks/bills`
**Purpose:** Create new bill in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
POST /quickbooks/bills
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "VendorRef": {
    "value": "359"
  },
  "TxnDate": "2025-08-01",
  "DueDate": "2025-08-31",
  "Line": [
    {
      "Amount": 500.00,
      "DetailType": "AccountBasedExpenseLineDetail",
      "AccountBasedExpenseLineDetail": {
        "AccountRef": {
          "value": "41"
        }
      }
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "bill": {
    "Id": "123",
    "SyncToken": "0",
    "TotalAmt": 500.00
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 394)
- Function: `createQBOBill(billData)`

---

#### 28. Get Bill by ID

**Endpoint:** `GET /quickbooks/bills/{bill_id}`
**Purpose:** Retrieve specific bill details
**Status:** ✅ Working in production

**Request:**
```http
GET /quickbooks/bills/123
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:** `200 OK`
```json
{
  "bill": {
    "Id": "123",
    "SyncToken": "0",
    "TotalAmt": 500.00
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 385)
- Function: `getQBOBill(billId)`

---

#### 29. Update Bill

**Endpoint:** `PUT /quickbooks/bills`
**Purpose:** Update existing bill in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
PUT /quickbooks/bills
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
Content-Type: application/json

{
  "Id": "123",
  "SyncToken": "0",
  "TotalAmt": 550.00
}
```

**Response:** `200 OK`
```json
{
  "bill": {
    "Id": "123",
    "SyncToken": "1",
    "TotalAmt": 550.00
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 403)
- Function: `updateQBOBill(billData)`

---

#### 30. Delete Bill

**Endpoint:** `DELETE /quickbooks/bills/{bill_id}`
**Purpose:** Void bill in QuickBooks
**Status:** ✅ Working in production

**Request:**
```http
DELETE /quickbooks/bills/123?sync_token=0
Authorization: Bearer {signature}.{timestamp}
X-Organization-ID: {org-uuid}
```

**Response:** `200 OK`
```json
{
  "bill": {
    "Id": "123",
    "SyncToken": "1",
    "Status": "Voided"
  }
}
```

**Frontend Implementation:**
- File: `src/api/quickbooksApi.js` (line 412)
- Function: `deleteQBOBill(billId, syncToken)`

---

## Data Models

### Customer Model

```typescript
interface QuickBooksCustomer {
  Id: string;                           // QuickBooks customer ID
  SyncToken: string;                    // Optimistic locking token
  DisplayName: string;                  // Display name in QB
  CompanyName?: string;                 // Company name
  FullyQualifiedName?: string;          // Full hierarchical name
  GivenName?: string;                   // First name
  FamilyName?: string;                  // Last name
  Title?: string;                       // Mr/Mrs/Ms/Dr
  Active: boolean;                      // Active status
  Taxable: boolean;                     // Taxable status
  Balance: number;                      // Current balance
  BalanceWithJobs: number;              // Balance including sub-customers
  CurrencyRef: {
    name: string;                       // Currency full name
    value: string;                      // Currency code (CAD/USD/EUR/GBP/AUD)
  };
  DefaultTaxCodeRef?: {
    value: string;                      // Tax code (3=non-CAD, 4=CAD)
  };
  PrimaryEmailAddr?: {
    Address: string;                    // Email address
  };
  PrimaryPhone?: {
    FreeFormNumber: string;             // Phone number
  };
  BillAddr?: {
    Id?: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Id?: string;
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  MetaData?: {
    CreateTime: string;                 // ISO 8601 timestamp
    LastUpdatedTime: string;            // ISO 8601 timestamp
  };
}
```

**Pydantic Reference:**
- Codat SDK: [customer.py](https://github.com/codatio/client-sdk-python/blob/main/sync-for-expenses/src/codat_sync_for_expenses/models/shared/customer.py)

---

### Invoice Model

```typescript
interface QuickBooksInvoice {
  Id: string;                           // QuickBooks invoice ID
  SyncToken: string;                    // Optimistic locking token
  DocNumber: string;                    // Invoice number (format: qboIDYYMMNNN)
  TxnDate: string;                      // Transaction date (YYYY-MM-DD)
  DueDate: string;                      // Due date (YYYY-MM-DD)
  TotalAmt: number;                     // Total amount
  Balance: number;                      // Outstanding balance
  CustomerRef: {
    name: string;                       // Customer display name
    value: string;                      // QuickBooks customer ID
  };
  CurrencyRef: {
    name: string;                       // Currency full name
    value: string;                      // Currency code
  };
  ExchangeRate?: number;                // Exchange rate for multi-currency
  EmailStatus: string;                  // NotSet | EmailSent
  EInvoiceStatus?: string;              // Viewed | NotViewed
  PrintStatus: string;                  // NotSet | NeedToPrint | PrintComplete
  BillEmail?: {
    Address: string;                    // Customer email
  };
  BillAddr?: {
    Id: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  DeliveryInfo?: {
    DeliveryType: string;               // Email | Print
    DeliveryTime?: string;              // ISO 8601 timestamp
  };
  GlobalTaxCalculation: string;         // TaxExcluded | TaxInclusive
  Line: Array<InvoiceLineItem>;         // Line items
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface InvoiceLineItem {
  Id: string;                           // Line item ID
  LineNum: number;                      // Line number (1-indexed)
  Description: string;                  // Product description
  Amount: number;                       // Line total (Qty * UnitPrice)
  DetailType: string;                   // Always "SalesItemLineDetail"
  SalesItemLineDetail: {
    ItemRef: {
      name: string;                     // Item name
      value: string;                    // QuickBooks item ID
    };
    UnitPrice: number;                  // Price per unit
    Qty: number;                        // Quantity
    TaxCodeRef: {
      value: string;                    // Tax code (3 or 4)
    };
  };
}
```

---

### Item Model

```typescript
interface QuickBooksItem {
  Id: string;                           // QuickBooks item ID
  SyncToken: string;                    // Optimistic locking token
  Name: string;                         // Item name
  Description?: string;                 // Item description
  Active: boolean;                      // Active status
  Type: string;                         // Service | Inventory | NonInventory
  UnitPrice?: number;                   // Default unit price
  Taxable: boolean;                     // Taxable status
  SalesTaxIncluded?: boolean;           // Tax included in price
  IncomeAccountRef?: {
    value: string;                      // Income account ID
    name: string;                       // Income account name
  };
  FullyQualifiedName?: string;          // Full hierarchical name
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}
```

---

### Vendor Model

```typescript
interface QuickBooksVendor {
  Id: string;                           // QuickBooks vendor ID
  SyncToken: string;                    // Optimistic locking token
  DisplayName: string;                  // Display name
  CompanyName?: string;                 // Company name
  PrintOnCheckName: string;             // Name on checks
  Active: boolean;                      // Active status
  Balance: number;                      // Current balance
  Vendor1099: boolean;                  // 1099 vendor status
  CurrencyRef: {
    name: string;                       // Currency full name
    value: string;                      // Currency code
  };
  PrimaryEmailAddr?: {
    Address: string;                    // Email address
  };
  PrimaryPhone?: {
    FreeFormNumber: string;             // Phone number
  };
  BillAddr?: {
    Id: string;
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}
```

---

### Bill Model

```typescript
interface QuickBooksBill {
  Id: string;                           // QuickBooks bill ID
  SyncToken: string;                    // Optimistic locking token
  DocNumber?: string;                   // Bill number
  TxnDate: string;                      // Transaction date (YYYY-MM-DD)
  DueDate: string;                      // Due date (YYYY-MM-DD)
  TotalAmt: number;                     // Total amount
  Balance: number;                      // Outstanding balance
  VendorRef: {
    name: string;                       // Vendor display name
    value: string;                      // QuickBooks vendor ID
  };
  CurrencyRef?: {
    name: string;                       // Currency full name
    value: string;                      // Currency code
  };
  Line: Array<BillLineItem>;            // Line items
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface BillLineItem {
  Id: string;                           // Line item ID
  Amount: number;                       // Line total
  DetailType: string;                   // AccountBasedExpenseLineDetail | ItemBasedExpenseLineDetail
  AccountBasedExpenseLineDetail?: {
    AccountRef: {
      value: string;                    // Expense account ID
      name?: string;                    // Expense account name
    };
    BillableStatus?: string;            // Billable | NotBillable
    CustomerRef?: {
      value: string;                    // Customer ID if billable
    };
  };
  ItemBasedExpenseLineDetail?: {
    ItemRef: {
      value: string;                    // Item ID
      name?: string;                    // Item name
    };
    Qty?: number;                       // Quantity
    UnitPrice?: number;                 // Price per unit
  };
}
```

---

## Error Handling

### Standard Error Response Format

```typescript
interface ErrorResponse {
  error: string;                        // Error message
  detail?: string;                      // Detailed error information
  fault?: QuickBooksFault;              // QuickBooks-specific error
}

interface QuickBooksFault {
  Error: Array<{
    Message: string;                    // Error message
    Detail: string;                     // Detailed description
    code: string;                       // QB error code
    element?: string;                   // Element that caused error
  }>;
  type: string;                         // Fault type
}
```

### Common HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | Success | Request completed successfully |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request data, missing required fields |
| `401` | Unauthorized | Invalid or expired HMAC token |
| `403` | Forbidden | Insufficient QuickBooks permissions |
| `404` | Not Found | Resource doesn't exist in QuickBooks |
| `422` | Validation Error | Request validation failed |
| `500` | Server Error | Internal server error |

### QuickBooks-Specific Error Codes

| QB Code | Description | Solution |
|---------|-------------|----------|
| `3200` | Stale sync token | Refresh entity to get current sync token |
| `610` | Object not found | Verify entity exists in QuickBooks |
| `3100` | Invalid reference | Check that referenced entities (customer, item) exist |
| `6000` | Business validation error | Review QuickBooks business rules |
| `3210` | Duplicate name | Use unique display names for entities |

### Error Handling in Frontend

**Frontend Implementation:**
- File: `src/components/financial/CustomerSalesTable.jsx` (lines 400-450)
- Comprehensive error serialization
- Handles multiple error formats:
  - Standard Error objects
  - QuickBooks Fault format
  - HTTP response errors
  - Network errors

**Example Error Handler:**
```javascript
// src/components/financial/CustomerSalesTable.jsx
const handleQBError = (error) => {
  let errorMessage = 'An unknown error occurred';

  // QuickBooks Fault format
  if (error.Fault?.Error?.[0]) {
    const qbError = error.Fault.Error[0];
    errorMessage = `${qbError.Message}: ${qbError.Detail}`;
  }
  // Standard error response
  else if (error.error || error.detail) {
    errorMessage = error.detail || error.error;
  }
  // Error object
  else if (error.message) {
    errorMessage = error.message;
  }

  console.error('QuickBooks Error:', errorMessage);
  showSnackbar(errorMessage, 'error');
};
```

---

## Business Logic Rules

### 1. Fixed-Price Project Detection

**Rule:** Projects with `f_fixedPrice > 0` skip `customer_sales` creation.

**Implementation:**
- File: `src/services/taskService.js` (lines 104-111)
- Timer record is created in FileMaker for tracking
- No hourly billing occurs
- Revenue recognized at project milestones (50% start, 50% completion)

**Code Reference:**
```javascript
// src/services/taskService.js:104-111
const project = await fetchProject(task.projectId);
const isFixedPrice = project?.f_fixedPrice > 0;

if (!isFixedPrice && result.success) {
  await createSaleFromFinancialRecord(result.data);
}
```

---

### 2. Hourly Rate Resolution

**Priority Order:**
1. Project-level rate (`customers_Projects::f_hourlyRate`)
2. Staff-level rate (`devStaff::f_HourlyRate`)
3. Organization default rate
4. Default to `0` if none found

**Implementation:**
- File: `src/services/salesService.js` (lines 50-75)

---

### 3. Product Name Formatting

**Format:** `{CUSTOMER_CAPS}:{PROJECT_FIRST_WORD}`

**Rules:**
- Extract ONLY capital letters and numbers from customer name
- Get first word of project name
- Combine with colon separator

**Examples:**
- "Clarity Business Solutions" + "Website Redesign" → "CBS:Website"
- "MacSpec Inc." + "McBride System" → "MI:McBride"

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 290-315)

**Code Reference:**
```javascript
const formatProductName = (customerName, projectName) => {
  // Extract caps and numbers from customer name
  const customerCaps = customerName.replace(/[^A-Z0-9]/g, '');

  // Get first word of project name
  const projectFirstWord = projectName.split(' ')[0];

  return `${customerCaps}:${projectFirstWord}`;
};
```

---

### 4. Invoice Document Number Generation

**Format:** `{qboCustomerId}{YY}{MM}{NNN}`

**Components:**
- `qboCustomerId` - QuickBooks customer ID (e.g., `140`)
- `YY` - Last 2 digits of year (e.g., `25` for 2025)
- `MM` - Month with leading zero (e.g., `06` for June)
- `NNN` - Sequential invoice number for this customer this month (e.g., `001`)

**Examples:**
- Customer 140, June 2025, 1st invoice → `140250601`
- Customer 12, January 2026, 3rd invoice → `122601003`

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 87-107)

**Algorithm:**
```javascript
const generateDocumentNumber = async (qboCustomerId, salesRecords) => {
  const latestDate = getLatestDate(salesRecords);
  const year = latestDate.getFullYear().toString().slice(-2);
  const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');

  // Query existing invoices for this customer and month
  const invoiceNumber = await getNextInvoiceSequence(qboCustomerId, latestDate);
  const sequence = invoiceNumber.toString().padStart(3, '0');

  return `${qboCustomerId}${year}${month}${sequence}`;
};
```

---

### 5. Tax Code Determination

**Rule:** Based on customer currency

**Mapping:**
- **CAD** → Tax Code `4` (includes HST/GST)
- **USD** → Tax Code `3` (tax exempt)
- **EUR** → Tax Code `3` (tax exempt)
- **GBP** → Tax Code `3` (tax exempt)
- **AUD** → Tax Code `3` (tax exempt)

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 178-190)

**Code Reference:**
```javascript
const getTaxCodeForCurrency = (currency) => {
  return currency === 'CAD' ? '4' : '3';
};
```

---

### 6. Item Reference Mapping

**Rule:** Based on customer currency

**Mapping:**
```javascript
const CURRENCY_ITEM_MAP = {
  'CAD': { name: 'Development CAD', value: '3' },
  'USD': { name: 'Development USD', value: '7' },
  'EUR': { name: 'Development EUR', value: '8' },
  'GBP': { name: 'Development CAD', value: '3' },  // Fallback to CAD
  'AUD': { name: 'Development CAD', value: '3' }   // Fallback to CAD
};
```

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 192-208)

---

### 7. Due Date Calculation

**Rule:** Net 30 (End of Month)

**Formula:**
1. Start with invoice date (latest date from sales records)
2. Add 30 days
3. Get end of that month

**Examples:**
- Invoice Date: Jan 10 → +30 days = Feb 9 → EOM = Feb 28
- Invoice Date: Jan 31 → +30 days = Mar 2 → EOM = Mar 31

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 210-226)

**Code Reference:**
```javascript
const calculateDueDate = (salesRecords) => {
  const latestDate = getLatestDate(salesRecords);

  // Add 30 days
  const dueDateTemp = new Date(latestDate);
  dueDateTemp.setDate(dueDateTemp.getDate() + 30);

  // Get end of month
  const year = dueDateTemp.getFullYear();
  const month = dueDateTemp.getMonth();
  const dueDate = new Date(year, month + 1, 0);

  return dueDate.toISOString().split('T')[0];
};
```

---

### 8. Line Item Grouping

**Rule:** Group by product name and unit price, consolidate quantities

**Algorithm:**
1. Iterate through sales records
2. For each record, create key: `{productName}|{unitPrice}`
3. If key exists, add quantity to existing line item
4. If key doesn't exist, create new line item
5. Calculate line total: `Qty * UnitPrice`

**Implementation:**
- File: `src/services/invoiceGenerationService.js` (lines 228-288)

**Code Reference:**
```javascript
const generateLineItems = (salesRecords, itemRef, taxCodeRef) => {
  const lineItemMap = {};

  salesRecords.forEach((record) => {
    const key = `${record.product_name}|${record.unit_price}`;

    if (lineItemMap[key]) {
      lineItemMap[key].Qty += record.quantity;
      lineItemMap[key].Amount = lineItemMap[key].Qty * lineItemMap[key].UnitPrice;
    } else {
      lineItemMap[key] = {
        Description: record.product_name,
        UnitPrice: record.unit_price,
        Qty: record.quantity,
        Amount: record.quantity * record.unit_price
      };
    }
  });

  return Object.values(lineItemMap).map((item, index) => ({
    LineNum: index + 1,
    Amount: item.Amount,
    Description: item.Description,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: itemRef,
      UnitPrice: item.UnitPrice,
      Qty: item.Qty,
      TaxCodeRef: taxCodeRef
    }
  }));
};
```

---

### 9. Billable Time Calculation

**Formula:** `Billable Time = Elapsed Time - Total Pause Time + Manual Adjustment`

**Components:**
- **Elapsed Time:** Time between start and stop
- **Total Pause Time:** Sum of all pause durations
- **Manual Adjustment:** User-specified adjustment in 6-minute increments

**Implementation:**
- File: `src/services/taskService.js` (lines 67-131)

**Code Reference:**
```javascript
const elapsedSeconds = Math.floor((endTime - timerState.startTime) / 1000);
const totalPauseSeconds = timerState.totalPauseTime || 0;
const adjustmentSeconds = (timerState.adjustment || 0) * 60;
const billableSeconds = elapsedSeconds - totalPauseSeconds + adjustmentSeconds;
```

---

## Summary

This document specifies 30 QuickBooks API endpoints covering:

1. **OAuth & Initialization** (4 endpoints)
   - Authorization flow, token refresh, validation

2. **Customer Management** (6 endpoints)
   - CRUD operations, search functionality

3. **Invoice Operations** (7 endpoints)
   - Invoice creation, management, email delivery

4. **Reference Data** (3 endpoints)
   - Items, vendors, company info

5. **Bill Operations** (5 endpoints)
   - Bill CRUD operations

6. **Testing & Utilities** (5 endpoints)
   - Webhooks, queries, testing tools

**Current Status:** All endpoints are implemented and working in production. This document serves as a comprehensive reference for the QuickBooks migration requirements.

**Next Steps:**
1. ✅ Backend endpoints are ready (no changes needed)
2. ✅ Frontend integration is complete (`src/api/quickbooksApi.js`)
3. 🔄 Timer migration to Supabase (in progress)
4. 🔄 Financial sync service updates (in progress)

**Related Documents:**
- `/docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` - Complete endpoint reference with cURL examples
- `.devflow/tasks/tasks-migration-requirements/QUICKBOOKS_INTEGRATION.md` - Full integration guide
- `src/api/quickbooksApi.js` - Frontend API client implementation
- `src/services/invoiceGenerationService.js` - Invoice payload generation logic

---

**Document Status:** Complete
**Approval Status:** ✅ No backend changes required - documentation only
**Last Updated:** 2026-01-10
