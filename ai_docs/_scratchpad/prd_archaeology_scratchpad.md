# PRD Archaeological Investigation Scratchpad

## Investigation Progress
- **Status**: Starting archaeological investigation
- **Date**: 2025-09-13
- **Objective**: Reverse engineer comprehensive PRD from existing codebase

## Methodology
Following the systematic archaeological investigation approach:
1. Product Structure Analysis
2. User Experience Reconstruction  
3. Business Logic Extraction
4. Technical Requirements Inference
5. Quality and Testing Analysis

## Findings Log

### Phase 1: Product Structure Analysis

#### Initial Codebase Overview
- **Project Type**: React-based CRM frontend application
- **Architecture**: Component-based with Redux state management + Context API
- **Backend Integration**: Multiple APIs (FileMaker, QuickBooks, Supabase)
- **Key Directories**:
  - `/src/components/` - Feature-organized React components
  - `/src/api/` - API integration modules
  - `/src/services/` - Business logic services
  - `/src/hooks/` - Custom React hooks
  - `/src/store/` - Redux state management
  - `/src/context/` - React Context providers

#### Core Application Structure Analysis
**Evidence**: `src/main.jsx`, `src/index.jsx`, `src/components/layout/AppLayout.jsx`, `src/components/layout/Sidebar.jsx`, `src/components/MainContent.jsx`

**Application Architecture**:
- **Multi-Environment Support**: FileMaker and Web App environments
- **Authentication Flow**: Dual authentication (FileMaker bridge + Supabase)
- **Layout Structure**: Fixed sidebar + main content area with top navigation
- **State Management**: Hybrid approach using Redux + Context providers
- **Error Handling**: Comprehensive error boundaries and global error handlers

**Navigation Structure** (from Sidebar.jsx):
- **Sidebar Modes**: 4 primary modes
  - `customer` - Customer management
  - `team` - Team management
  - `product` - Product catalog
  - `marketing` - Marketing campaigns
- **Dynamic Content**: MainContent switches based on selected items
- **Feature Flags**: Environment-controlled feature visibility

#### Feature Inventory (Evidence-Based)
- [x] **Authentication & User Management** - Dual auth system (FileMaker + Supabase)
- [x] **Customer Management** - Full CRUD with active/inactive status
- [x] **Project Management** - Project details, objectives, tasks, links, notes
- [x] **Financial Management & QuickBooks Integration** - Financial activity tracking
- [x] **Task Management** - Task creation, timer functionality, status tracking
- [x] **Marketing System** - Domain-based marketing campaigns
- [x] **Proposal System** - Referenced in documentation
- [x] **Team Management** - Staff assignment, project assignment
- [x] **Product Management** - Product catalog with pricing
- [x] **Reporting & Analytics** - Billable hours, project stats
- [x] **API Testing Tools** - FileMaker, Supabase, QuickBooks test panels

## Evidence Collection Template
```
Feature: [name]
→ Evidence: [code references]
→ Requirements: [extracted requirements]
→ User Personas: [who uses this]
→ Business Rules: [validation/logic]
→ Non-functional: [performance/security]
→ Confidence: [high/medium/low]
```

### Phase 2: User Experience Reconstruction

#### Authentication System Analysis
**Evidence**: `src/components/auth/SignIn.jsx`, `src/services/dataService.js`, `docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md`

**Dual Authentication Architecture**:
- **FileMaker Environment**: Auto-detection via FMGofer/FileMaker bridge, silent authentication
- **Web App Environment**: Supabase email/password authentication with form UI
- **M2M Authentication**: HMAC-SHA256 signature-based for backend API access
- **Environment Detection**: Automatic detection with 3-second timeout fallback

**User Personas Identified** (High Confidence):
1. **Administrator**: Full system access, can manage all entities (customers, teams, projects)
   - Evidence: Role-based access patterns in `ai_docs/context/add.md`
   - Permissions: All CRUD operations, financial data access, team management
2. **Manager**: Team oversight and project management
   - Evidence: Permission patterns show manager-level access to teams and financials
   - Permissions: Customer/project management, team oversight, financial reporting
3. **Team Member**: Task execution and time tracking
   - Evidence: Task timer functionality, project participation
   - Permissions: Task management, time tracking, project participation
4. **Client**: Limited access to project status
   - Evidence: Proposal system with token-based public access
   - Permissions: View assigned projects, proposal approval

**Authentication Requirements**:
- **User Authentication**: Kong Gateway + Supabase for frontend applications
- **M2M Authentication**: HMAC-SHA256 for backend API access
- **Organization Context**: Required for QuickBooks operations via `X-Organization-ID` header
- **Security**: HTTPS-only, token-based sessions, CSRF protection

#### User Journey Mapping
**Primary User Flows** (from MainContent.jsx routing):
1. **Customer Management Flow**: Select customer → View details → Manage projects
2. **Project Management Flow**: Select project → View tabs (Proposals → Team → Objectives → Tasks → Notes → Links)
3. **Task Management Flow**: Select task → Timer functionality → Status tracking
4. **Team Management Flow**: Select team → Manage staff → Assign projects
5. **Financial Flow**: Access financial activity → QuickBooks integration → Reporting
6. **Marketing Flow**: Select domain → Campaign management

### Phase 4: Detailed User Personas and Role-Based Access

#### 4.1 Comprehensive User Persona Analysis
**Status**: ✅ COMPLETED - Detailed role-based access control patterns analyzed

**Evidence-Based User Personas** (High Confidence):

#### 1. Administrator Persona
- **Role Identifier**: `admin`
- **Access Level**: Full system access and configuration
- **Core Responsibilities**:
  - System configuration and maintenance
  - User management and role assignment
  - Complete data access across all domains
  - Financial oversight and reporting
  - Team structure management
- **Permissions Matrix**:
  ```javascript
  canViewCustomers: true,
  canEditCustomers: true,
  canDeleteCustomers: true,  // ONLY admin role
  canViewFinancials: true,
  canManageTeam: true,
  canAccessAllProjects: true,
  canManageSystemSettings: true
  ```
- **Primary Workflows**:
  - Complete customer lifecycle management
  - Financial reporting and analysis
  - Team performance oversight
  - System configuration and user management
- **UI Access**: All sidebar modes (customer, team, product, marketing)

#### 2. Manager Persona
- **Role Identifier**: `manager`
- **Access Level**: Team oversight and project management
- **Core Responsibilities**:
  - Project planning and oversight
  - Team coordination and task assignment
  - Financial reporting and client billing
  - Customer relationship management
  - Performance monitoring
- **Permissions Matrix**:
  ```javascript
  canViewCustomers: true,
  canEditCustomers: true,
  canDeleteCustomers: false,  // Cannot delete
  canViewFinancials: true,
  canManageTeam: true,
  canCreateProjects: true,
  canAssignTasks: true
  ```
- **Primary Workflows**:
  - Project creation and management
  - Team member task assignment
  - Customer communication and proposals
  - Financial activity monitoring
  - Performance reporting
- **UI Access**: Customer, team, and financial management interfaces

#### 3. Team Member Persona
- **Role Identifier**: `team_member` or `staff`
- **Access Level**: Task execution and time tracking
- **Core Responsibilities**:
  - Task completion and time tracking
  - Project participation and updates
  - Status reporting to managers
  - Client communication (limited)
- **Permissions Matrix**:
  ```javascript
  canViewCustomers: true,      // Can view but limited edit
  canEditCustomers: false,     // Cannot edit customer data
  canDeleteCustomers: false,   // Cannot delete
  canViewFinancials: false,    // No financial access
  canManageTeam: false,        // Cannot manage team
  canManageTasks: true,        // Can manage assigned tasks
  canUseTimer: true           // Can track time
  ```
- **Primary Workflows**:
  - Task timer start/stop/pause functionality
  - Task status updates and completion
  - Project objective step completion
  - Time record creation and adjustment
- **UI Access**: Limited to assigned projects and tasks, timer functionality

#### 4. Client Persona
- **Role Identifier**: `client`
- **Access Level**: Limited access to project status and communications
- **Core Responsibilities**:
  - Project status monitoring
  - Proposal review and approval
  - Communication with project team
  - Invoice and deliverable review
- **Permissions Matrix**:
  ```javascript
  canViewCustomers: false,     // Cannot view other customers
  canEditCustomers: false,     // Cannot edit customer data
  canDeleteCustomers: false,   // Cannot delete
  canViewFinancials: false,    // No financial access
  canManageTeam: false,        // Cannot manage team
  canViewOwnProjects: true,    // Can view assigned projects only
  canApproveProposals: true    // Can approve proposals via token
  ```
- **Primary Workflows**:
  - Token-based proposal access and approval
  - Project status and progress monitoring
  - Communication with project team
  - Deliverable review and acceptance
- **UI Access**: Token-based public proposal interface, limited project views

#### 4.2 Advanced Permission Patterns

#### Role Hierarchy and Inheritance
```javascript
const roleHierarchy = {
  admin: ['manager', 'team_member', 'client'],      // Inherits all permissions
  manager: ['team_member'],                         // Inherits team member permissions
  team_member: [],                                  // Base permissions only
  client: []                                        // Isolated permissions
}
```

#### Context-Aware Permissions
- **Organization Scoping**: All permissions scoped to user's organization
- **Project Assignment**: Team members only access assigned projects
- **Customer Relationship**: Clients only access their own projects
- **Time-Based Access**: Proposal tokens have expiration dates

#### Protected Route Implementation
```javascript
const ProtectedRoute = ({ children, requiredPermission }) => {
  const permissions = usePermissions()
  
  if (!permissions[requiredPermission]) {
    return <AccessDenied />
  }
  
  return children
}
```

#### 4.3 User Experience Patterns by Role

#### Administrator Experience
- **Dashboard**: Comprehensive system overview with all metrics
- **Navigation**: Full access to all sidebar modes and features
- **Data Views**: Complete customer, financial, and team data
- **Actions**: All CRUD operations across all entities

#### Manager Experience
- **Dashboard**: Team and project performance metrics
- **Navigation**: Customer, team, and financial interfaces
- **Data Views**: Team-scoped data with customer and financial visibility
- **Actions**: Project and team management, customer relationship management

#### Team Member Experience
- **Dashboard**: Personal task list and timer interface
- **Navigation**: Limited to assigned projects and tasks
- **Data Views**: Task-focused with project context
- **Actions**: Task management, time tracking, status updates

#### Client Experience
- **Dashboard**: Project status and communication interface
- **Navigation**: Token-based access to specific proposals/projects
- **Data Views**: Project progress and deliverable status
- **Actions**: Proposal approval, communication, feedback submission

#### 4.4 Security and Access Control Patterns

#### Authentication Integration
- **Supabase Auth**: User authentication with role assignment
- **JWT Tokens**: Role information embedded in authentication tokens
- **Session Management**: Role-based session validation
- **Organization Context**: Multi-tenant access control

#### Row Level Security (RLS)
- **Database Policies**: Supabase RLS policies enforce role-based data access
- **Organization Isolation**: Data scoped to user's organization
- **Project Assignment**: Team members restricted to assigned projects
- **Token-Based Access**: Public proposal access via secure tokens

**Next Steps**: Move to Phase 5 - Document business rules and validation logic

### Phase 3: Core Business Features and Data Models

#### 3.1 Business Domain Analysis
**Status**: ✅ COMPLETED - Comprehensive business domain mapping completed

**Key Business Domains Identified**:

#### Customer Management Domain
- **Core Entity**: Customer with comprehensive profile management
- **Data Model**:
  ```javascript
  Customer: {
    id, Name, Email, Phone, Address, ContactPerson,
    isActive, createdAt, modifiedAt
  }
  ```
- **Business Logic**: Active/inactive status management, contact validation
- **Validation Rules**: Required name, email format validation, phone format validation
- **Operations**: CRUD operations, status toggling, customer statistics calculation

#### Project Management Domain
- **Core Entity**: Project with multiple types and lifecycle management
- **Data Model**:
  ```javascript
  Project: {
    id, projectName, customerId, status, dateStart, dateEnd,
    f_fixedPrice, f_subscription, value, objectives[],
    images[], links[], records[], stats
  }
  ```
- **Project Types**:
  1. **Billable Projects**: Standard hourly billing
  2. **Fixed Price Projects**: Set price with 50% on start, 50% on completion
  3. **Subscription Projects**: Monthly recurring billing
- **Business Rules**:
  - Cannot be both fixed price AND subscription
  - Fixed price projects: Value required, split billing (50% start/50% completion)
  - Subscription projects: Value and start date required, monthly billing cycles
  - Automatic sales record generation based on project type
- **Lifecycle**: Open → In Progress → Completed/Closed
- **Related Entities**: Objectives with steps, images, links, time records

#### Task Management Domain
- **Core Entity**: Task with timer functionality and detailed tracking
- **Data Model**:
  ```javascript
  Task: {
    id, task, projectId, staffId, type, isCompleted,
    f_priority, createdAt, modifiedAt
  }
  ```
- **Task Operations**:
  - Create, update, status change (active/completed)
  - Timer functionality (start/stop/pause/adjust)
  - Notes and links attachment
  - Priority management (active, high, low)
- **Business Rules**:
  - Tasks belong to projects and are assigned to staff
  - Timer adjustments in 6-minute increments
  - Automatic sales record creation on timer stop (for billable projects)
- **Validation**: Required task name, project ID, staff ID

#### Financial Management Domain
- **Core Entity**: Financial Records with comprehensive billing tracking
- **Data Model**:
  ```javascript
  FinancialRecord: {
    id, customerId, projectId, hours, rate, amount,
    date, month, year, billed, description, taskName,
    workPerformed, fixedPrice
  }
  ```
- **Billing System**:
  - Time-based billing with hourly rates
  - Fixed price project handling (non-billable hours)
  - Subscription billing automation
  - Invoice status tracking
- **Financial Analytics**:
  - Monthly/quarterly/yearly reporting
  - Billed vs unbilled tracking
  - Customer-specific financial summaries
  - Chart visualization (bar, line, stacked charts)

#### Sales Management Domain
- **Core Entity**: Sales records with dual-source data
- **Data Model**:
  ```javascript
  Sale: {
    id, customer_id, product_id, product_name, quantity,
    unit_price, total_price, date, inv_id, organization_id,
    financial_id
  }
  ```
- **Sales Sources**:
  1. **Time-based Sales**: Auto-generated from billable hours
  2. **Project-based Sales**: Auto-generated from fixed/subscription projects
  3. **Manual Sales**: Direct product/service sales
- **Business Logic**:
  - Automatic customer creation/linking in Supabase
  - Product naming convention: "CUSTOMERNAME:ProjectFirstWord"
  - Invoice status tracking (billed/unbilled)
  - Organization-scoped access control

#### 3.2 Data Architecture Patterns

#### Multi-Environment Data Strategy
- **FileMaker Integration**: Primary data source for operational data
- **Supabase Integration**: Modern database for sales, customers, organizations
- **Dual-Write Pattern**: Critical data synchronized between systems
- **Environment Detection**: Automatic fallback between FileMaker and web-only modes

#### Data Processing Patterns
- **Service Layer Architecture**: Business logic separated from UI components
- **Data Transformation**: Consistent processing pipelines for FileMaker → UI
- **Validation Layers**: Client-side and service-level validation
- **Error Handling**: Comprehensive error management with user-friendly messages

#### State Management Architecture
- **Redux Toolkit**: Global state management for shared data
- **Context API**: Domain-specific state (customer details, app state)
- **Custom Hooks**: Utility functions only (NOT data fetching)
- **Local State**: Component-level UI state only

#### 3.3 Business Rules and Constraints

#### Project Business Rules
1. **Project Type Exclusivity**: Cannot be both fixed price and subscription
2. **Fixed Price Billing**: 50% on project start, 50% on completion
3. **Subscription Billing**: Monthly charges from start date to end date
4. **Time Tracking**: Fixed price projects have non-billable hours
5. **Status Workflow**: Open → Active → Completed/Closed

#### Financial Business Rules
1. **Automatic Sales Generation**: Timer stops create sales records
2. **Customer Linking**: Automatic Supabase customer creation/linking
3. **Product Naming**: Standardized format for service identification
4. **Invoice Tracking**: Comprehensive billed/unbilled status management
5. **Organization Scoping**: All financial data scoped to organizations

#### Validation Rules
1. **Customer Validation**: Name required, email/phone format validation
2. **Project Validation**: Name and customer required, value validation for fixed/subscription
3. **Task Validation**: Name, project, and staff assignment required
4. **Financial Validation**: Customer, project, hours, and date required
5. **Sales Validation**: Customer, organization, unit price, and quantity required

#### 3.4 Integration Patterns

#### FileMaker Integration
- **Layout-based API**: Structured data access through defined layouts
- **Script Execution**: Server-side business logic execution
- **Real-time Updates**: Immediate data synchronization
- **Error Handling**: Comprehensive FileMaker error code management

#### QuickBooks Integration
- **OAuth Authentication**: Secure API access
- **Customer Synchronization**: Bi-directional customer data sync
- **Invoice Management**: Complete invoice lifecycle management
- **Webhook Support**: Real-time event notifications

#### Supabase Integration
- **Row Level Security**: Organization-based data access control
- **Real-time Subscriptions**: Live data updates
- **Authentication Integration**: User and organization management
- **Batch Operations**: Efficient bulk data operations

### Phase 5: Business Rules and Validation Logic

**Status**: ✅ COMPLETED - Comprehensive business rules and validation patterns documented
**Objective**: Document comprehensive business rules, validation patterns, and data processing logic

#### 5.1 Multi-Layer Validation Architecture

**Validation Framework Structure**:
1. **Client-Side Validation**: Form validation with real-time feedback
2. **Service-Layer Validation**: Business logic validation in service functions
3. **API-Level Validation**: Server-side validation before data persistence
4. **Data Type Validation**: Type checking and format validation

#### 5.2 Task Management Business Rules

**Task Field Validation Rules**:
```javascript
TASK_FIELDS = {
  task: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200,
    validate: (value) => {
      if (!value?.trim()) return 'Task name is required';
      if (value.length > 200) return 'Task name must be less than 200 characters';
      return null;
    }
  },
  _projectID: {
    required: true,
    type: 'string',
    validate: (value) => !value ? 'Project ID is required' : null
  },
  _staffID: {
    required: true,
    type: 'string',
    validate: (value) => !value ? 'Staff ID is required' : null
  },
  f_completed: {
    required: false,
    type: 'number',
    validate: (value) => {
      if (value === undefined || value === null) return null;
      return value === 0 || value === 1 ? null : 'Completion status must be 0 or 1';
    }
  },
  f_priority: {
    required: false,
    type: 'string',
    validate: (value) => {
      if (!value) return null;
      return ['active', 'high', 'low'].includes(value) ? null : 'Invalid priority value';
    }
  }
}
```

**Task Business Logic**:
- **UUID Generation**: All tasks get unique UUIDs for cross-system identification
- **Timer Integration**: Task completion triggers sales record creation (except fixed-price projects)
- **Fixed-Price Project Rule**: Timer stops on fixed-price projects do NOT create sales records
- **6-Minute Timer Adjustments**: Timer adjustments must be in 6-minute increments
- **Automatic Sales Generation**: Timer stops automatically create Supabase sales records
- **Organization Scoping**: All task operations scoped to user's organization

#### 5.3 Customer Management Business Rules

**Customer Validation Rules**:
```javascript
validateCustomerData(data) {
  const errors = [];
  
  // Required fields
  if (!data.Name?.trim()) {
    errors.push('Customer name is required');
  }
  
  // Email validation
  if (data.Email && !isValidEmail(data.Email)) {
    errors.push('Invalid email format');
  }
  
  // Phone validation
  if (data.Phone && !isValidPhone(data.Phone)) {
    errors.push('Invalid phone format');
  }
  
  // Charge rate validation
  if (!data.chargeRate || isNaN(data.chargeRate) || parseFloat(data.chargeRate) <= 0) {
    errors.push('Charge rate must be a positive number');
  }
  
  return { isValid: errors.length === 0, errors };
}
```

**Customer Business Logic**:
- **Dual-System Creation**: Customers created in both FileMaker and Supabase
- **UUID Consistency**: FileMaker UUID used as Supabase customer ID
- **Currency Support**: Multi-currency support (CAD, USD, EUR) with flags
- **Charge Rate Requirement**: All customers must have positive charge rates
- **Email Format Validation**: Standard email regex validation
- **Active Status Management**: Boolean flags converted to FileMaker strings ("1"/"0")

#### 5.4 Financial Records Business Rules

**Financial Validation Rules**:
```javascript
validateFinancialRecordData(data) {
  const errors = {};
  
  // Required fields validation
  validateRequired(errors, data, 'customerId', 'Customer is required');
  validateRequired(errors, data, 'projectId', 'Project is required');
  validateRequired(errors, data, 'hours', 'Hours are required');
  validateRequired(errors, data, 'date', 'Date is required');
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
```

**Financial Business Logic**:
- **Automatic Amount Calculation**: Amount = Hours × Rate (calculated in service layer)
- **Billed Status Tracking**: Boolean flags for billed/unbilled status
- **Monthly Aggregation**: Records grouped by month/year for reporting
- **Customer Grouping**: Records grouped by customer with fallback to customer name
- **Project Association**: All financial records must be associated with projects
- **Date Range Filtering**: Support for date-based filtering and reporting
- **Currency Formatting**: Automatic currency formatting for display

#### 5.5 Project Management Business Rules

**Project Type Validation**:
```javascript
validate = () => {
  const newErrors = {};
  
  if (!projectName.trim()) {
    newErrors.projectName = 'Project name is required';
  }
  
  if ((projectType === 'fixed' || projectType === 'subscription') &&
      (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0)) {
    newErrors.value = 'Value is required and must be a positive number';
  }
  
  if (projectType === 'subscription' && !dateStart) {
    newErrors.dateStart = 'Start date is required for subscription projects';
  }
  
  return Object.keys(newErrors).length === 0;
}
```

**Project Business Logic**:
- **Three Project Types**: Billable (hourly), Fixed Price, Subscription
- **Type-Specific Validation**: Different validation rules per project type
- **Fixed Price Rules**: Require value, timer stops don't create sales records
- **Subscription Rules**: Require start date and value
- **Billable Rules**: Standard hourly billing with timer integration
- **Customer Association**: All projects must be associated with customers

#### 5.6 Invoice Generation Business Rules

**Invoice Document Number Format**: `{qboCustomerId}{YY}{MM}{NNN}`
- **YY**: Last 2 digits of year
- **MM**: Month with leading zero
- **NNN**: Sequential invoice number for customer/month (001, 002, etc.)

**Tax Code Rules**:
- **CAD Currency**: Tax code 4
- **Non-CAD Currency**: Tax code 3

**Due Date Calculation**: Net 30 (End of Month)
- **Formula**: 30 days from invoice date, then end of that month
- **Example**: Invoice on Jan 15 → Due Feb 28/29

**Currency-Specific Item Mapping**:
```javascript
const itemMapping = {
  CAD: { name: 'Development CAD', value: '3' },
  USD: { name: 'Development USD', value: '7' },
  EUR: { name: 'Development EUR', value: '8' }
};
```

**Invoice Validation Rules**:
```javascript
validateInvoiceData(salesRecords, qboCustomer) {
  const errors = [];
  
  // Sales records validation
  if (!salesRecords || !Array.isArray(salesRecords) || salesRecords.length === 0) {
    errors.push('Sales records are required and must be a non-empty array');
  }
  
  // Individual record validation
  salesRecords.forEach((record, index) => {
    if (!record.date) errors.push(`Sales record ${index + 1} is missing date`);
    if (record.unit_price === undefined || record.unit_price === null) {
      errors.push(`Sales record ${index + 1} is missing unit_price`);
    }
    if (record.quantity === undefined || record.quantity === null) {
      errors.push(`Sales record ${index + 1} is missing quantity`);
    }
    if (record.total_price === undefined || record.total_price === null) {
      errors.push(`Sales record ${index + 1} is missing total_price`);
    }
  });
  
  // Customer validation
  if (!qboCustomer || !qboCustomer.Id) {
    errors.push('QuickBooks customer is required with valid Id');
  }
  
  return { isValid: errors.length === 0, errors };
}
```

#### 5.7 Product Management Business Rules

**Product Validation Rules**:
```javascript
validateProductData(data) {
  const errors = [];

  if (!data.name?.trim()) {
    errors.push('Product name is required');
  }

  if (data.price === undefined || data.price === null ||
      isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0) {
    errors.push('Product price must be a positive number');
  }

  if (!data.organization_id) {
    errors.push('Organization ID is required');
  }

  return { isValid: errors.length === 0, errors };
}
```

**Product Business Logic**:
- **Organization Scoping**: All products scoped to organizations
- **Positive Price Requirement**: All products must have positive prices
- **Name Requirement**: Product names are mandatory
- **Price Validation**: Numeric validation with positive value requirement

#### 5.8 Sales Management Business Rules

**Sales Validation Rules**:
```javascript
validateSaleData(data) {
  const errors = [];
  
  if (!data.customer_id) {
    errors.push('Customer ID is required');
  }
  
  if (!data.id && !data.financial_id && !data.product_id && !data.project_id) {
    errors.push('Either Product ID or Project ID is required');
  }
  
  if (!data.date) {
    errors.push('Sale date is required');
  }
  
  return { isValid: errors.length === 0, errors };
}
```

**Sales Business Logic**:
- **Customer Association**: All sales must be associated with customers
- **Source Flexibility**: Sales can be linked to products, projects, or financial records
- **Date Requirement**: All sales must have valid dates
- **Organization Scoping**: All sales scoped to organizations
- **Automatic Generation**: Sales automatically created from timer stops

#### 5.9 Error Handling Framework

**Service Error Classes**:
```javascript
class ServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }
}

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  INVALID_DATA: 'INVALID_DATA',
  CALCULATION_ERROR: 'CALCULATION_ERROR'
};
```

**Validation Utilities**:
```javascript
function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new ServiceError(
      `Missing required fields: ${missing.join(', ')}`,
      ErrorCodes.VALIDATION_ERROR,
      { missing }
    );
  }
}

function validateDataType(value, type, fieldName) {
  if (typeof value !== type) {
    throw new ServiceError(
      `Invalid type for ${fieldName}. Expected ${type}, got ${typeof value}`,
      ErrorCodes.VALIDATION_ERROR,
      { fieldName, expectedType: type, actualType: typeof value }
    );
  }
}
```

#### 5.10 Data Processing Rules

**Financial Data Processing**:
- **Amount Calculation**: Automatic calculation from hours × rate
- **Currency Formatting**: Automatic formatting for display
- **Date Formatting**: Consistent date formatting across system
- **Grouping Logic**: Customer and project-based grouping
- **Aggregation Rules**: Monthly and yearly aggregations for reporting

**Task Data Processing**:
- **Timer Duration Calculation**: Automatic duration calculations
- **Status Grouping**: Active vs completed task grouping
- **Priority Sorting**: Priority-based task sorting
- **Completion Tracking**: Boolean completion status management

**Customer Data Processing**:
- **Active Status Filtering**: Filter active vs inactive customers
- **Currency Flag Management**: Multi-currency support flags
- **Contact Information Validation**: Email and phone format validation
- **Charge Rate Processing**: Numeric validation and formatting

#### 5.11 Key Business Constraints

1. **Organization Isolation**: All data strictly scoped to user organizations
2. **UUID Consistency**: FileMaker UUIDs used across all systems
3. **Multi-Currency Support**: CAD, USD, EUR with appropriate tax codes
4. **Timer Business Logic**: 6-minute increments, fixed-price exclusions
5. **Dual-System Architecture**: FileMaker + Supabase synchronization
6. **Validation Layers**: Client, service, and API-level validation
7. **Error Recovery**: Graceful degradation with meaningful error messages
8. **Data Integrity**: Required field validation across all entities
9. **Financial Accuracy**: Precise calculations with rounding rules
10. **Invoice Compliance**: Structured document numbering and tax handling

### Phase 6: API Integrations and External Services

**Status**: ✅ COMPLETED - Comprehensive API architecture and external service integrations analyzed
**Objective**: Analyze API layer, external service integrations, and technical requirements

#### 6.1 API Architecture Overview

**Evidence**: `src/api/index.js`, `src/api/fileMaker.js`, `src/api/quickbooksApi.js`, `src/services/supabaseService.js`, `src/api/marketing.js`

**Multi-Environment API Strategy**:
- **FileMaker Integration**: Primary operational data source with layout-based API access
- **QuickBooks Online**: Financial integration with OAuth authentication and comprehensive operations
- **Supabase**: Modern database with real-time capabilities and authentication
- **Marketing Automation**: Bulk email campaigns with CSV import and template validation
- **Dual-Write Architecture**: Sophisticated data synchronization between FileMaker and Supabase

#### 6.2 FileMaker Integration Analysis

**Evidence**: `src/api/fileMaker.js` (501 lines)

**FileMaker API Architecture**:
```javascript
// Environment-aware routing with automatic detection
const getBaseUrl = () => {
  if (window.FileMaker) {
    return 'fmp://$/ClarityAdmin/'; // FileMaker environment
  }
  return config.fileMakerApiUrl; // Web environment
}

// Dual routing system
const makeRequest = async (endpoint, options = {}) => {
  if (window.FileMaker) {
    return await fileMakerRequest(endpoint, options);
  }
  return await webRequest(endpoint, options);
}
```

**Key FileMaker Integration Features**:
- **Environment Detection**: Automatic detection of FileMaker vs web environment with 3-second timeout
- **Layout-Based API**: Structured data access through predefined FileMaker layouts
- **Script Execution**: Server-side business logic execution via FileMaker scripts
- **Dual Routing**: Seamless switching between FileMaker bridge and HTTP API
- **Error Handling**: Comprehensive FileMaker error code management
- **Real-time Updates**: Immediate data synchronization with FileMaker database

**FileMaker API Endpoints** (High Confidence):
```javascript
// Customer Management
GET /customers - Fetch all customers
POST /customers - Create new customer
PUT /customers/:id - Update customer
DELETE /customers/:id - Delete customer

// Project Management
GET /projects - Fetch all projects
POST /projects - Create new project
PUT /projects/:id - Update project
GET /projects/:id/tasks - Fetch project tasks

// Task Management
GET /tasks - Fetch all tasks
POST /tasks - Create new task
PUT /tasks/:id - Update task
POST /tasks/:id/timer/start - Start task timer
POST /tasks/:id/timer/stop - Stop task timer

// Financial Records
GET /financial-records - Fetch financial records
POST /financial-records - Create financial record
PUT /financial-records/:id - Update financial record
```

#### 6.3 QuickBooks Online Integration Analysis

**Evidence**: `src/api/quickbooksApi.js` (578 lines), `docs/reference/QUICKBOOKS_ENDPOINTS_REFERENCE.md` (1021 lines)

**QuickBooks API Architecture**:
```javascript
// OAuth-based authentication with organization context
const qboApiCall = async (endpoint, options = {}) => {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'X-Organization-ID': organizationId, // Multi-tenant support
    ...options.headers
  };
  
  return await fetch(`${QBO_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
}
```

**QuickBooks Integration Features**:
- **OAuth Authentication**: Secure API access with token management
- **Multi-Tenant Support**: Organization-scoped access via `X-Organization-ID` header
- **Comprehensive Operations**: Full CRUD operations for customers, items, invoices
- **Webhook Support**: Real-time event notifications from QuickBooks
- **Error Handling**: Detailed error management with retry logic
- **Rate Limiting**: Built-in rate limiting and throttling

**QuickBooks API Operations** (High Confidence):
```javascript
// Customer Operations
GET /customers - Fetch all customers
POST /customers - Create customer
PUT /customers/:id - Update customer
GET /customers/:id - Get customer details

// Invoice Operations
GET /invoices - Fetch all invoices
POST /invoices - Create invoice
PUT /invoices/:id - Update invoice
GET /invoices/:id/pdf - Get invoice PDF

// Item Operations
GET /items - Fetch all items
POST /items - Create item
PUT /items/:id - Update item

// Company Information
GET /companyinfo/:id - Get company details
```

**Invoice Generation Business Logic**:
```javascript
// Document number format: {qboCustomerId}{YY}{MM}{NNN}
const generateDocNumber = (qboCustomerId, date) => {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const sequence = getNextSequenceNumber(qboCustomerId, year, month);
  return `${qboCustomerId}${year}${month}${sequence.toString().padStart(3, '0')}`;
}

// Currency-specific tax codes
const getTaxCode = (currency) => {
  return currency === 'CAD' ? '4' : '3';
}

// Net 30 due date calculation
const calculateDueDate = (invoiceDate) => {
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0); // End of month
}
```

#### 6.4 Supabase Integration Analysis

**Evidence**: `src/services/supabaseService.js` (713 lines)

**Supabase Architecture**:
```javascript
// Dual client architecture for different authentication contexts
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);

// Organization-scoped operations
const getOrganizationData = async (tableName, organizationId) => {
  const { data, error } = await supabaseClient
    .from(tableName)
    .select('*')
    .eq('organization_id', organizationId);
    
  if (error) throw new ServiceError('Failed to fetch data', error);
  return data;
}
```

**Supabase Integration Features**:
- **Dual Client Architecture**: Separate clients for user and service operations
- **Row Level Security (RLS)**: Organization-based data access control
- **Real-time Subscriptions**: Live data updates via WebSocket connections
- **Authentication Integration**: User and organization management
- **Batch Operations**: Efficient bulk data operations with upsert support
- **Error Handling**: Comprehensive error management with retry logic

**Supabase Data Models** (High Confidence):
```javascript
// Organizations table
organizations: {
  id: 'uuid',
  name: 'text',
  created_at: 'timestamp',
  updated_at: 'timestamp'
}

// Customers table
customers: {
  id: 'uuid',
  organization_id: 'uuid',
  name: 'text',
  email: 'text',
  phone: 'text',
  currency: 'text',
  qbo_customer_id: 'text',
  created_at: 'timestamp'
}

// Sales table
sales: {
  id: 'uuid',
  organization_id: 'uuid',
  customer_id: 'uuid',
  product_id: 'uuid',
  financial_id: 'uuid',
  quantity: 'numeric',
  unit_price: 'numeric',
  total_price: 'numeric',
  date: 'date',
  inv_id: 'text'
}

// Products table
products: {
  id: 'uuid',
  organization_id: 'uuid',
  name: 'text',
  price: 'numeric',
  created_at: 'timestamp'
}
```

#### 6.5 Marketing Automation Integration

**Evidence**: `src/api/marketing.js` (475 lines)

**Marketing API Architecture**:
```javascript
// Bulk email campaign management
const sendBulkEmail = async (campaignData) => {
  const { recipients, template, subject } = campaignData;
  
  // CSV import validation
  const validatedRecipients = validateEmailList(recipients);
  
  // Template processing
  const processedTemplate = processEmailTemplate(template);
  
  // Batch sending with rate limiting
  return await sendEmailBatch(validatedRecipients, processedTemplate, subject);
}
```

**Marketing Integration Features**:
- **Bulk Email Campaigns**: Mass email sending with CSV import support
- **Template Validation**: Email template validation and processing
- **Recipient Management**: CSV import with email validation
- **Campaign Tracking**: Email delivery and engagement tracking
- **Rate Limiting**: Built-in rate limiting for email sending
- **Error Handling**: Comprehensive error management for failed sends

#### 6.6 Dual-Write Architecture Analysis

**Evidence**: `src/services/dualWriteService.js`

**Dual-Write Implementation**:
```javascript
// Sophisticated dual-write with rollback support
const dualWriteOperation = async (fileMakerData, supabaseData) => {
  const transaction = await beginTransaction();
  
  try {
    // Write to FileMaker first (primary source)
    const fileMakerResult = await fileMakerApi.create(fileMakerData);
    
    // Write to Supabase with FileMaker UUID
    const supabaseResult = await supabaseService.create({
      ...supabaseData,
      id: fileMakerResult.id // Use FileMaker UUID
    });
    
    await commitTransaction(transaction);
    return { fileMakerResult, supabaseResult };
    
  } catch (error) {
    await rollbackTransaction(transaction);
    throw new DualWriteError('Dual write operation failed', error);
  }
}
```

**Dual-Write Features**:
- **Transaction Support**: Atomic operations across both systems
- **Rollback Capability**: Automatic rollback on failure
- **UUID Consistency**: FileMaker UUIDs used across all systems
- **Error Recovery**: Comprehensive error handling and recovery
- **Data Synchronization**: Bi-directional data sync between systems

#### 6.7 Authentication Architecture

**Evidence**: `docs/FRONTEND_AUTHENTICATION_COMPREHENSIVE_GUIDE.md`

**Multi-Layer Authentication**:
```javascript
// Dual authentication pathways
const authenticateUser = async () => {
  // 1. FileMaker environment detection
  if (window.FileMaker) {
    return await fileMakerAuth();
  }
  
  // 2. Supabase JWT authentication
  const { user, session } = await supabaseAuth();
  
  // 3. M2M HMAC-SHA256 for backend API
  const hmacSignature = generateHMACSignature(payload, secretKey);
  
  return { user, session, hmacSignature };
}
```

**Authentication Features**:
- **Dual Authentication**: FileMaker bridge + Supabase JWT
- **M2M Security**: HMAC-SHA256 signature-based authentication
- **Organization Context**: Multi-tenant access control
- **Session Management**: Secure session handling with token refresh
- **Environment Detection**: Automatic authentication pathway selection

#### 6.8 API Error Handling Patterns

**Comprehensive Error Management**:
```javascript
// Standardized error handling across all APIs
class APIError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}

const handleAPIError = (error, context) => {
  // Log error with context
  console.error(`API Error in ${context}:`, error);
  
  // Transform error for UI
  return {
    message: getUserFriendlyMessage(error),
    code: error.code,
    retryable: isRetryableError(error)
  };
}
```

**Error Handling Features**:
- **Standardized Error Classes**: Consistent error handling across all APIs
- **Context-Aware Logging**: Detailed error logging with operation context
- **User-Friendly Messages**: Error message transformation for UI display
- **Retry Logic**: Automatic retry for transient errors
- **Graceful Degradation**: Fallback behavior when APIs are unavailable

#### 6.9 Performance Optimization Strategies

**API Performance Features**:
- **Request Batching**: Batch multiple API calls for efficiency
- **Caching Strategy**: Intelligent caching with TTL and invalidation
- **Connection Pooling**: Efficient connection management
- **Rate Limiting**: Built-in rate limiting and throttling
- **Lazy Loading**: On-demand data loading for large datasets
- **Compression**: Request/response compression for bandwidth optimization

**Caching Implementation**:
```javascript
// Multi-layer caching strategy
const cacheManager = {
  // In-memory cache for frequently accessed data
  memoryCache: new Map(),
  
  // Browser storage for persistent data
  persistentCache: localStorage,
  
  // Cache with TTL and invalidation
  get: async (key, fetchFn, ttl = 300000) => {
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const data = await fetchFn();
    memoryCache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

#### 6.10 Technical Requirements Summary

**Multi-Environment Support**:
- **FileMaker Environment**: Native FileMaker integration with bridge detection
- **Web Environment**: Standard HTTP API with authentication
- **Automatic Detection**: Seamless switching between environments

**Security Requirements**:
- **HTTPS Only**: All API communications over HTTPS
- **Token-Based Authentication**: JWT tokens for user authentication
- **HMAC-SHA256**: Enterprise-grade M2M authentication
- **Organization Isolation**: Multi-tenant data access control
- **Row Level Security**: Database-level access control

**Performance Requirements**:
- **Sub-second Response Times**: Optimized API response times
- **Batch Operations**: Efficient bulk data operations
- **Caching Strategy**: Multi-layer caching for performance
- **Connection Pooling**: Efficient resource utilization
- **Rate Limiting**: Protection against API abuse

**Reliability Requirements**:
- **Error Recovery**: Comprehensive error handling and recovery
- **Transaction Support**: Atomic operations across systems
- **Rollback Capability**: Data consistency guarantees
- **Monitoring**: Comprehensive API monitoring and alerting
- **Graceful Degradation**: Fallback behavior for system failures

## Next Steps
1. ✅ Examine main application structure and routing
2. ✅ Analyze authentication and user management
3. ✅ Map core business features and data models
4. ✅ Extract user personas from role-based access
5. ✅ Document business rules and validation logic
6. ✅ Analyze API integrations and external services