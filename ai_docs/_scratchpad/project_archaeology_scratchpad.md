# Project Archaeology Investigation - Clarity CRM Frontend

## Investigation Log

### Phase 1: Structural Analysis

#### Repository Structure Analysis
- **Evidence**: Directory structure shows React frontend with organized components by domain
- **Inference**: Professional-grade business application with clear separation of concerns
- **Confidence**: High

#### Key Directories Identified:
- `src/components/` - Domain-organized React components (customers, financial, marketing, projects, proposals, tasks, teams)
- `src/api/` - API integration layer with multiple external services
- `src/services/` - Business logic services
- `src/hooks/` - Custom React hooks for data management
- `src/store/` - Redux state management
- `docs/` - Comprehensive documentation
- `supabase/` - Backend integration functions

#### Technology Stack Evidence:
- **Frontend**: React, Redux Toolkit, styled-components
- **Backend Integration**: Supabase, FileMaker, QuickBooks
- **Build Tools**: Vite, Rollup
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

### Phase 2: Business Logic Extraction

#### Core Business Domains Identified:
1. **Customer Management** - Evidence: `src/components/customers/`, `src/api/customers.js`
2. **Financial Management** - Evidence: `src/components/financial/`, QuickBooks integration
3. **Project Management** - Evidence: `src/components/projects/`, task management
4. **Marketing** - Evidence: `src/components/marketing/`, email campaigns
5. **Proposal System** - Evidence: `src/components/proposals/`, PDF generation
6. **Team Management** - Evidence: `src/components/teams/`

#### External Integrations:
- **QuickBooks** - Financial data synchronization
- **FileMaker** - Legacy database integration
- **Supabase** - Modern database and authentication
- **Mailjet** - Email marketing service

### Phase 3: User Experience Archaeology

#### Authentication System:
- **Evidence**: `src/components/auth/SignIn.jsx`, Supabase auth integration
- **Inference**: Secure user authentication with role-based access
- **Confidence**: High

#### User Roles Inferred:
- Business administrators (full access)
- Project managers (project-focused access)
- Team members (limited access)

### Phase 4: Operational Intelligence

#### Performance Optimizations:
- **Evidence**: Code splitting, lazy loading patterns
- **Inference**: Built for scalability and performance
- **Confidence**: Medium

#### Security Implementations:
- **Evidence**: Authentication guards, input validation
- **Inference**: Security-conscious development
- **Confidence**: High

### Phase 5: Historical Reconstruction

#### Development Timeline:
- **Evidence**: Git history analysis needed
- **Inference**: Iterative development with multiple phases
- **Confidence**: Low (requires git analysis)

## Key Findings Summary

### Business Purpose:
- **Primary Function**: Comprehensive business management system
- **Target Users**: Small to medium businesses
- **Core Value**: Unified platform for customer, project, and financial management

### Competitive Advantages:
- Multi-system integration (QuickBooks, FileMaker)
- Comprehensive proposal generation
- Integrated marketing capabilities
- Real-time financial synchronization

### Technical Architecture:
- Modern React frontend
- Multi-database backend strategy
- Microservices architecture with edge functions
- Real-time data synchronization

## Phase 5: Service Layer Analysis - COMPLETED

### Service Layer Architecture Discovery

**Core Business Services Identified:**

#### 1. billableHoursService.js - Financial Data Processing Engine
- **Primary Function**: Processes raw FileMaker financial data into structured business objects
- **Key Capabilities**:
  - Complex field mapping with fallback strategies (Tasks::task vs dapiTasks::task)
  - Multi-dimensional data grouping (by customer, project, time periods)
  - Advanced chart data preparation (bar, line, stacked, quarterly, yearly)
  - Sophisticated financial calculations and aggregations
  - Comprehensive validation and formatting utilities
- **Business Intelligence**:
  - Monthly/quarterly revenue analysis with year-over-year comparisons
  - Customer profitability tracking
  - Project-based financial reporting
  - Billing status management (billed vs unbilled tracking)

#### 2. salesService.js - Supabase Sales Management
- **Primary Function**: Complete CRUD operations for customer_sales table in Supabase
- **Key Capabilities**:
  - Organization-scoped sales data management
  - Unbilled sales tracking (null inv_id filtering)
  - Time-based sales queries (current month, date ranges)
  - Batch sales creation with error handling
  - Targeted PATCH updates for specific fields
  - JSON data processing and validation
- **Integration Patterns**:
  - Automatic customer creation and organization linking
  - Financial record synchronization (financial_id mapping)
  - Product name formatting rules (CustomerCode:ProjectName)
  - Comprehensive error handling with rollback capabilities

#### 3. financialSyncService.js - Multi-System Data Synchronization
- **Primary Function**: Ensures data consistency between FileMaker (devRecords) and Supabase (customer_sales)
- **Key Capabilities**:
  - Bi-directional data comparison and conflict resolution
  - Batch synchronization with dry-run capabilities
  - Orphaned record detection and cleanup
  - Change tracking with localStorage persistence
  - Customer auto-creation and organization linking
- **Synchronization Logic**:
  - Case-insensitive financial_id matching
  - Precision-based numeric comparisons (2 decimal places)
  - Product name standardization
  - Date format conversion between systems

#### 4. proposalService.js - Client Proposal Management
- **Primary Function**: Complete proposal lifecycle management
- **Key Capabilities**:
  - Multi-component proposal creation (deliverables, concepts)
  - Token-based client access system
  - Proposal statistics and analytics
  - Expiration tracking and validation
  - URL generation for client viewing
- **Business Logic**:
  - Automatic total price calculation from deliverables
  - Status tracking (draft, sent, viewed, approved, rejected)
  - Time-based expiration management
  - Client interaction logging

#### 5. mailjetService.js - Professional Email Communications
- **Primary Function**: Enterprise email delivery via Mailjet API
- **Key Capabilities**:
  - FileMaker-integrated configuration management
  - PDF attachment support
  - HTML email template generation
  - Email validation and error handling
  - User context integration
- **Integration Pattern**:
  - FMGofer script execution for API calls
  - Dynamic sender configuration from user context
  - Professional email templates with company branding
  - Comprehensive error reporting and validation

### Business Logic Patterns Discovered

#### 1. Multi-System Integration Strategy
- **FileMaker as Source of Truth**: Core business data originates in FileMaker
- **Supabase as Modern Interface**: Customer-facing operations use Supabase
- **Synchronization Layer**: Ensures data consistency across systems
- **API Gateway Pattern**: Unified access through service layer

#### 2. Data Processing Pipeline
```
FileMaker Raw Data → Service Processing → Business Objects → UI Components
                  ↓
            Validation & Formatting → Error Handling → User Feedback
```

#### 3. Error Handling Philosophy
- **Graceful Degradation**: Systems continue operating with partial failures
- **Comprehensive Logging**: Detailed error tracking for debugging
- **User-Friendly Messages**: Technical errors translated to business language
- **Rollback Capabilities**: Failed operations can be safely reversed

#### 4. Business Intelligence Integration
- **Real-time Analytics**: Live financial reporting and trend analysis
- **Customer Insights**: Profitability and engagement tracking
- **Project Performance**: Resource utilization and billing efficiency
- **Predictive Capabilities**: Revenue forecasting and capacity planning

### Service Layer Evidence Summary

**Sophistication Level**: Enterprise-grade business logic implementation
**Integration Complexity**: Multi-system synchronization with conflict resolution
**Business Intelligence**: Advanced analytics and reporting capabilities
**Error Resilience**: Comprehensive error handling and recovery mechanisms
**Scalability**: Batch processing and performance optimization patterns

This service layer reveals a mature, production-ready system designed for professional service businesses with complex financial tracking, client management, and multi-system integration requirements.

## Next Investigation Steps:
1. ✅ **COMPLETED**: Analyze service layer business logic patterns
2. Examine React component workflows for user experience patterns
3. Review Redux store structure for state management architecture
4. Investigate error handling for risk mitigation strategies
5. Analyze configuration files for deployment and scaling patterns