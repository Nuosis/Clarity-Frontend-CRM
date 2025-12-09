# Enhanced Proposal System - New UI Components

## Overview

This document describes the new UI components created for the enhanced proposal system. These components provide a complete tabbed interface for managing all aspects of proposals including requests, concepts, deliverables, requirements, and package summaries.

## Components Created

### 1. RequestsTab.jsx

**Purpose**: Documents client asks and feature requests

**Location**: `src/components/proposals/RequestsTab.jsx`

**Features**:
- Add/remove client requests
- Numbered list interface
- Clean empty state
- Auto-growing textarea for each request

**Usage**:
```jsx
import RequestsTab from './RequestsTab';

<RequestsTab
  requests={requests}
  onChange={setRequests}
/>
```

**Props**:
- `requests` (array): Array of request objects with `{id, text}`
- `onChange` (function): Callback when requests change

### 2. RequiredFromCustomer.jsx

**Purpose**: Manages proposal_requirements table - what customer must provide

**Location**: `src/components/proposals/RequiredFromCustomer.jsx`

**Features**:
- Add/edit/remove requirements
- Category selection (content, access, assets, documentation, credentials, other)
- Priority levels (low, medium, high, critical)
- Color-coded badges for categories and priorities
- Required/optional toggle
- Helpful tip box with examples

**Usage**:
```jsx
import RequiredFromCustomer from './RequiredFromCustomer';

<RequiredFromCustomer
  requirements={requirements}
  onChange={setRequirements}
/>
```

**Props**:
- `requirements` (array): Array of requirement objects
- `onChange` (function): Callback when requirements change

**Requirement Object Structure**:
```javascript
{
  id: 'uuid',
  title: 'Logo files in SVG format',
  description: 'Detailed description...',
  category: 'assets', // content, access, assets, documentation, credentials, other
  priority: 'high',    // low, medium, high, critical
  is_required: true
}
```

### 3. DeliverablesTab.jsx

**Purpose**: Manages proposal deliverables with subscription support

**Location**: `src/components/proposals/DeliverablesTab.jsx`

**Features**:
- Add/edit/remove deliverables
- Three deliverable types:
  - **Fixed Price**: One-time cost
  - **Hourly Rate**: Time-based with estimated hours
  - **Subscription**: Recurring revenue (monthly, quarterly, yearly)
- Required/optional toggle
- **Add Deliverable button in footer** (left of Cancel)
- Real-time total calculation
- Type badges with color coding

**Usage**:
```jsx
import DeliverablesTab from './DeliverablesTab';

<DeliverablesTab
  deliverables={deliverables}
  onChange={setDeliverables}
  onCancel={handleCancel}
/>
```

**Props**:
- `deliverables` (array): Array of deliverable objects
- `onChange` (function): Callback when deliverables change
- `onCancel` (function, optional): Callback for cancel action

**Deliverable Object Structure**:
```javascript
{
  id: 'uuid',
  title: 'Website Development',
  description: 'Full-stack development...',
  price: 5000,
  type: 'fixed', // fixed, hourly, subscription
  estimated_hours: 40, // for hourly type
  billing_interval: 'monthly', // for subscription type
  is_required: false,
  order: 0
}
```

### 4. SummaryTab.jsx

**Purpose**: Creates and manages proposal packages with automatic pricing

**Location**: `src/components/proposals/SummaryTab.jsx`

**Features**:
- Create/edit/delete packages
- Three quick-create options:
  - **MVP Package**: Essential features (~33% of deliverables)
  - **Professional Package**: Complete solution (~70% of deliverables, 10% discount, featured)
  - **Premium Package**: Everything included (100% of deliverables, 15% discount)
- Custom package creation with modal
- Automatic price calculations:
  - Fixed costs (sum of fixed deliverables)
  - Hourly estimates with range (±50%)
  - Monthly recurring costs (subscriptions normalized to monthly)
  - Discount application
- Select deliverables and requirements per package
- Featured package highlighting
- Visual package cards with all pricing details

**Usage**:
```jsx
import SummaryTab from './SummaryTab';

<SummaryTab
  packages={packages}
  deliverables={deliverables}
  requirements={requirements}
  onChange={setPackages}
/>
```

**Props**:
- `packages` (array): Array of package objects
- `deliverables` (array): Available deliverables
- `requirements` (array): Available requirements
- `onChange` (function): Callback when packages change

**Package Pricing Calculations**:

The component automatically calculates:

1. **Fixed Cost**: Sum of all fixed-price deliverables
2. **Hourly Estimate**: Rate × Hours for each hourly deliverable
   - Shows range: `estimate × 0.5` to `estimate × 1.5`
3. **Monthly Recurring**: Subscription deliverables normalized to monthly:
   - Monthly: price as-is
   - Quarterly: price ÷ 3
   - Yearly: price ÷ 12
4. **Base Total**: Fixed Cost + Hourly Estimate
5. **Final Price**: Base Total × (1 - discount_percentage/100)

**Package Object Structure**:
```javascript
{
  id: 'uuid',
  name: 'Professional Package',
  description: 'Complete solution...',
  discount_percentage: 10,
  is_featured: true,
  deliverable_ids: ['deliv-1', 'deliv-2'],
  requirement_ids: ['req-1', 'req-2'],
  base_price: 10000,
  final_price: 9000,
  fixed_cost: 5000,
  hourly_estimate: 5000,
  hourly_range: { low: 2500, high: 7500 },
  monthly_recurring: 500
}
```

### 5. ProposalTabs.jsx

**Purpose**: Main tabbed interface container

**Location**: `src/components/proposals/ProposalTabs.jsx`

**Features**:
- Tab navigation with active states
- Badge showing count of items in each tab
- Visual indicator (dot) for tabs with content
- Smooth transitions between tabs
- Responsive tab layout
- Integrates all five tab components

**Usage**:
```jsx
import ProposalTabs from './ProposalTabs';

<ProposalTabs
  requests={requests}
  concepts={concepts}
  deliverables={deliverables}
  requirements={requirements}
  packages={packages}
  onRequestsChange={setRequests}
  onConceptsChange={setConcepts}
  onDeliverablesChange={setDeliverables}
  onRequirementsChange={setRequirements}
  onPackagesChange={setPackages}
  onConceptUpload={handleConceptUpload}
  defaultTab="requests"
/>
```

**Tabs**:
1. **Requests** - Client asks and feature requests
2. **Concepts & Assets** - Visual concepts, mockups, wireframes
3. **Deliverables** - What you'll deliver (fixed, hourly, subscription)
4. **Required From Customer** - What customer must provide
5. **Summary** - Package bundles with pricing

### 6. ProposalCreationFormEnhanced.jsx

**Purpose**: Complete proposal creation form with new tabbed interface

**Location**: `src/components/proposals/ProposalCreationFormEnhanced.jsx`

**Features**:
- Clean, modern design with styled-components
- Basic info section (title, description)
- Integrated ProposalTabs component
- Real-time total calculation
- Package count display
- Submit/Cancel actions
- Error handling
- Loading states

**Usage**:
```jsx
import ProposalCreationFormEnhanced from './ProposalCreationFormEnhanced';

<ProposalCreationFormEnhanced
  project={project}
  onProposalCreate={handleCreate}
  onCancel={handleCancel}
/>
```

**Props**:
- `project` (object): Project data with id, name, customer info
- `onProposalCreate` (function, optional): Callback when proposal is created
- `onCancel` (function, optional): Callback for cancel action

## Implementation Guide

### Step 1: Import the Enhanced Form

Replace your current ProposalCreationForm import:

```javascript
// Old
import ProposalCreationForm from './components/proposals/ProposalCreationForm';

// New
import ProposalCreationFormEnhanced from './components/proposals/ProposalCreationFormEnhanced';
```

### Step 2: Use the Enhanced Form

The enhanced form has the same basic API:

```jsx
<ProposalCreationFormEnhanced
  project={selectedProject}
  onProposalCreate={(proposal) => {
    console.log('Proposal created:', proposal);
    // Handle navigation, etc.
  }}
  onCancel={() => {
    // Optional: Handle cancel
  }}
/>
```

### Step 3: Update Redux Store (if needed)

The enhanced form uses the same Redux actions. Ensure your `createProposal` action handles the new fields:

```javascript
// In your proposalSlice.js
const proposalData = {
  title,
  description,
  projectId,
  customerId,
  requests,        // NEW
  concepts,
  deliverables,
  requirements,    // NEW
  packages,        // NEW
  totalPrice,
  selectedPrice
};
```

## Typical Workflow

1. **Basic Info**: Enter title and description
2. **Requests Tab**: Document client asks
   - Add each request the client mentioned
   - These help clarify scope

3. **Concepts & Assets Tab**: Add visual materials
   - Upload mockups, wireframes
   - Add reference materials

4. **Deliverables Tab**: Define what you'll deliver
   - Add fixed-price items: "Website Development - $5,000"
   - Add hourly items: "Custom Features - $150/hr × 20 hours"
   - Add subscriptions: "Monthly Maintenance - $500/month"

5. **Required From Customer Tab**: Specify what client provides
   - "Logo files in SVG format" (Assets, High Priority)
   - "Admin access to hosting" (Access, Critical)
   - "Brand guidelines document" (Documentation, Medium)

6. **Summary Tab**: Create packages
   - Click "Create MVP Package" for quick basic package
   - Click "Create Professional Package" for featured package
   - Click "Create Premium Package" for everything included
   - Or create custom packages with specific selections

7. **Submit**: Review totals and create proposal

## Pricing Example

Given these deliverables:
- Website Development (Fixed): $5,000
- Custom Features (Hourly): $150/hr × 40 hours = $6,000
- Monthly Support (Subscription): $500/month

**MVP Package** (Website Development only):
- Fixed Cost: $5,000
- Total: $5,000

**Professional Package** (Website + Custom, 10% discount):
- Fixed Cost: $5,000
- Hourly Estimate: $6,000 (range: $3,000 - $9,000)
- Base Total: $11,000
- Discount: 10%
- Final Price: $9,900

**Premium Package** (Everything, 15% discount):
- Fixed Cost: $5,000
- Hourly Estimate: $6,000 (range: $3,000 - $9,000)
- Monthly Recurring: $500/mo
- Base Total: $11,000
- Discount: 15%
- Final Price: $9,350
- Plus: $500/month ongoing

## Styling

All components use styled-components with theme support. They will automatically adapt to your theme:

```javascript
const theme = {
  colors: {
    primary: '#007bff',
    primaryDark: '#0056b3',
    primaryLight: 'rgba(0, 123, 255, 0.1)',
    danger: '#dc3545',
    success: '#28a745',
    // ... etc
  }
};
```

## Backend Integration Notes

The UI is ready for backend integration. When backend APIs are available:

### For Requests
Currently stored as array in proposal object. Backend team developing `requests` table.

### For Requirements
Maps directly to `proposal_requirements` table (already defined in migration).

Use the API from `src/api/proposalExtended.js`:
```javascript
import { createProposalRequirement } from '../api/proposalExtended';

await createProposalRequirement({
  proposal_id: proposalId,
  title: requirement.title,
  description: requirement.description,
  category: requirement.category,
  priority: requirement.priority,
  is_required: requirement.is_required
});
```

### For Packages
Maps to `proposal_packages` table with join tables.

Use the API:
```javascript
import { createCompletePackage } from '../api/proposalExtended';

await createCompletePackage(
  proposalId,
  {
    name: pkg.name,
    description: pkg.description,
    base_price: pkg.base_price,
    discount_percentage: pkg.discount_percentage,
    final_price: pkg.final_price,
    is_featured: pkg.is_featured
  },
  pkg.deliverable_ids,
  pkg.requirement_ids
);
```

## Testing Checklist

- [ ] Can create proposal with all tabs
- [ ] Requests tab saves/loads correctly
- [ ] Concepts tab allows file upload
- [ ] Deliverables support all three types (fixed, hourly, subscription)
- [ ] Requirements have correct categories and priorities
- [ ] Quick create buttons generate correct packages
- [ ] Package pricing calculations are accurate
- [ ] Fixed costs sum correctly
- [ ] Hourly estimates show correct range
- [ ] Subscription costs normalize to monthly
- [ ] Discounts apply correctly
- [ ] Featured packages display prominently
- [ ] Form validation works
- [ ] Submit creates proposal successfully
- [ ] Cancel works if provided

## Future Enhancements

1. **Drag-and-drop reordering** for deliverables and requirements
2. **Duplicate package** functionality
3. **Package templates** for reuse across proposals
4. **Preview mode** to see client view
5. **Comparison view** for multiple packages
6. **Export to PDF** functionality
7. **Import from previous proposals**
8. **AI suggestions** for requirements based on deliverables

## Support

For questions or issues:
- Review the component prop types
- Check console for errors
- Verify Redux store structure
- See main documentation: [EXTENDED_PROPOSAL_SYSTEM.md](../../docs/proposals/EXTENDED_PROPOSAL_SYSTEM.md)
