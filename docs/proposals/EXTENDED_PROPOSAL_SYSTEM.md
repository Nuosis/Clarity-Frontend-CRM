# Extended Proposal System Documentation

## Overview

This document describes the extended proposal system that adds support for:
- **Projects** - Parent entity for proposals
- **Proposal Requirements** - Client deliverables to developers
- **Proposal Packages** - Bundled collections of deliverables and requirements
- **Subscription Deliverables** - Recurring revenue support

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Reference](#api-reference)
3. [Service Layer](#service-layer)
4. [React Hooks](#react-hooks)
5. [Usage Examples](#usage-examples)
6. [Migration Guide](#migration-guide)

---

## Database Schema

### Tables Overview

```
projects
├── proposals (one-to-many)
    ├── proposal_deliverables (one-to-many)
    ├── proposal_requirements (one-to-many)
    ├── proposal_concepts (one-to-many)
    └── proposal_packages (one-to-many)
        ├── proposal_packages_deliverables (many-to-many)
        └── proposal_packages_requirements (many-to-many)
```

### 1. Projects Table

**Purpose**: Parent entity for proposals. A customer can have multiple projects, and each project can have multiple proposals over time.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active, pending, on_hold, completed, cancelled
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget DECIMAL(10,2),
  github_repo_url TEXT,
  project_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

**Key Features**:
- Tracks project lifecycle from active to completed
- Links to customer and optionally to GitHub repos
- Stores budget and timeline information

### 2. Proposal Requirements Table

**Purpose**: Tracks what the client must provide to developers to satisfy deliverables.

```sql
CREATE TABLE proposal_requirements (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- content, access, assets, documentation, credentials, other
  is_required BOOLEAN DEFAULT TRUE,
  is_fulfilled BOOLEAN DEFAULT FALSE,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by TEXT,
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features**:
- Categorizes requirements by type
- Tracks fulfillment status
- Supports priority levels
- Records who fulfilled and when

**Example Requirements**:
- "Provide logo files in SVG format"
- "Grant admin access to hosting account"
- "Share brand guidelines document"
- "Provide API credentials for third-party service"

### 3. Updated Proposal Deliverables

**Enhancement**: Added support for subscription-based deliverables.

```sql
ALTER TABLE proposal_deliverables
  ADD COLUMN billing_interval TEXT, -- monthly, quarterly, yearly
  ADD COLUMN subscription_duration_months INTEGER;

-- Updated type constraint
ALTER TABLE proposal_deliverables
  DROP CONSTRAINT proposal_deliverables_type_check;

ALTER TABLE proposal_deliverables
  ADD CONSTRAINT proposal_deliverables_type_check
  CHECK (type IN ('fixed', 'hourly', 'subscription'));
```

**Deliverable Types**:
1. **Fixed** - One-time cost (e.g., "Website Design - $5,000")
2. **Hourly** - Time-based (e.g., "Custom Development - $150/hr, 40 hours")
3. **Subscription** - Recurring (e.g., "Monthly Maintenance - $500/month")

### 4. Proposal Packages Table

**Purpose**: Bundled collections of deliverables and requirements offered at a package price.

```sql
CREATE TABLE proposal_packages (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  final_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  badge_text TEXT, -- e.g., "Most Popular", "Best Value"
  badge_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features**:
- Bundles multiple deliverables together
- Applies package-level discounts
- Can be marked as featured
- Custom badges for visual appeal

**Example Packages**:
- **Starter Package** ($2,500) - Basic website + 1 month support
- **Professional Package** ($5,000) - Advanced website + 3 months support + SEO
- **Enterprise Package** ($10,000) - Everything + custom integrations + 1 year support

### 5. Join Tables

#### proposal_packages_deliverables

Links packages to deliverables with optional price overrides.

```sql
CREATE TABLE proposal_packages_deliverables (
  id UUID PRIMARY KEY,
  package_id UUID REFERENCES proposal_packages(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES proposal_deliverables(id) ON DELETE CASCADE,
  price_override DECIMAL(10,2), -- Override deliverable price for this package
  is_required_in_package BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (package_id, deliverable_id)
);
```

#### proposal_packages_requirements

Links packages to requirements.

```sql
CREATE TABLE proposal_packages_requirements (
  id UUID PRIMARY KEY,
  package_id UUID REFERENCES proposal_packages(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES proposal_requirements(id) ON DELETE CASCADE,
  is_required_in_package BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (package_id, requirement_id)
);
```

---

## API Reference

### Requirements API

Located in: [src/api/proposalExtended.js](../../src/api/proposalExtended.js)

#### Fetch Requirements
```javascript
import { fetchProposalRequirements } from '../api/proposalExtended';

const result = await fetchProposalRequirements(proposalId);
// Returns: { success: true, data: [requirements] }
```

#### Create Requirement
```javascript
import { createProposalRequirement } from '../api/proposalExtended';

const result = await createProposalRequirement({
  proposal_id: 'uuid',
  title: 'Logo files required',
  description: 'Please provide logo in SVG and PNG formats',
  category: 'assets',
  priority: 'high',
  is_required: true
});
```

#### Update Requirement
```javascript
import { updateProposalRequirement } from '../api/proposalExtended';

const result = await updateProposalRequirement(requirementId, {
  is_fulfilled: true,
  fulfilled_at: new Date().toISOString(),
  fulfilled_by: 'client@email.com'
});
```

#### Delete Requirement
```javascript
import { deleteProposalRequirement } from '../api/proposalExtended';

const result = await deleteProposalRequirement(requirementId);
```

### Packages API

#### Fetch Packages
```javascript
import { fetchProposalPackages } from '../api/proposalExtended';

const result = await fetchProposalPackages(proposalId);
// Returns packages with deliverables and requirements
```

#### Create Package
```javascript
import { createProposalPackage } from '../api/proposalExtended';

const result = await createProposalPackage({
  proposal_id: 'uuid',
  name: 'Professional Package',
  description: 'Complete website with support',
  base_price: 5000.00,
  discount_percentage: 10,
  final_price: 4500.00,
  is_featured: true,
  badge_text: 'Most Popular',
  badge_color: '#4CAF50'
});
```

#### Add Deliverable to Package
```javascript
import { addDeliverableToPackage } from '../api/proposalExtended';

const result = await addDeliverableToPackage(packageId, deliverableId, {
  price_override: 1000.00, // Optional: override price for this package
  is_required_in_package: true,
  order_index: 0
});
```

#### Fetch Package with Complete Data
```javascript
import { fetchCompletePackage } from '../api/proposalExtended';

const result = await fetchCompletePackage(packageId);
// Returns package with all deliverables and requirements populated
```

### Projects API

#### Fetch Project
```javascript
import { fetchProject } from '../api/proposalExtended';

const result = await fetchProject(projectId);
```

#### Create Project
```javascript
import { createProject } from '../api/proposalExtended';

const result = await createProject({
  customer_id: 'customer-123',
  name: 'Website Redesign',
  description: 'Complete website overhaul',
  status: 'active',
  budget: 10000.00,
  start_date: '2025-01-01',
  target_end_date: '2025-06-30'
});
```

---

## Service Layer

Located in: [src/services/proposalExtendedService.js](../../src/services/proposalExtendedService.js)

### Data Processors

The service layer provides processors to convert snake_case API responses to camelCase:

```javascript
import { processRequirementData, processPackageData } from '../services/proposalExtendedService';

// API returns: { proposal_id: 'uuid', is_fulfilled: false }
const processed = processRequirementData(apiData);
// Returns: { proposalId: 'uuid', isFulfilled: false }
```

### Validation Functions

#### Validate Requirement
```javascript
import { validateRequirementData } from '../services/proposalExtendedService';

const validation = validateRequirementData({
  title: 'Logo files',
  proposalId: 'uuid',
  category: 'assets'
});

if (!validation.isValid) {
  console.error(validation.errors);
}
```

#### Validate Package
```javascript
import { validatePackageData } from '../services/proposalExtendedService';

const validation = validatePackageData({
  name: 'Pro Package',
  proposalId: 'uuid',
  basePrice: 5000,
  discountPercentage: 10
});
```

#### Validate Deliverable (with subscription support)
```javascript
import { validateDeliverableData } from '../services/proposalExtendedService';

const validation = validateDeliverableData({
  title: 'Monthly Support',
  type: 'subscription',
  price: 500,
  billingInterval: 'monthly'
});
```

### Business Logic Functions

#### Calculate Requirement Stats
```javascript
import { calculateRequirementStats } from '../services/proposalExtendedService';

const stats = calculateRequirementStats(requirements);
// Returns: {
//   total: 10,
//   fulfilled: 7,
//   pending: 3,
//   required: 8,
//   optional: 2,
//   fulfillmentRate: 70
// }
```

#### Calculate Package Price
```javascript
import { calculatePackagePrice } from '../services/proposalExtendedService';

const pricing = calculatePackagePrice(deliverables, 15); // 15% discount
// Returns: {
//   basePrice: 5000,
//   discountAmount: 750,
//   discountPercentage: 15,
//   finalPrice: 4250
// }
```

#### Calculate Subscription MRR
```javascript
import { calculateSubscriptionMRR } from '../services/proposalExtendedService';

const mrr = calculateSubscriptionMRR(deliverables);
// Returns: {
//   totalMRR: 1500,
//   subscriptionCount: 3,
//   breakdown: [
//     { id: 'uuid', title: 'Monthly Support', monthlyEquivalent: 500 },
//     { id: 'uuid', title: 'Quarterly SEO', monthlyEquivalent: 333.33 },
//     { id: 'uuid', title: 'Annual Hosting', monthlyEquivalent: 666.67 }
//   ]
// }
```

---

## React Hooks

Located in: [src/hooks/useProposalExtended.js](../../src/hooks/useProposalExtended.js)

### useProposalRequirements

Manages proposal requirements with full CRUD operations.

```javascript
import { useProposalRequirements } from '../hooks/useProposalExtended';

function RequirementsPanel({ proposalId }) {
  const {
    requirements,
    stats,
    loading,
    error,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    fulfillRequirement,
    refresh
  } = useProposalRequirements(proposalId);

  const handleCreate = async () => {
    const result = await createRequirement({
      title: 'New requirement',
      category: 'content',
      priority: 'high'
    });

    if (result.success) {
      console.log('Created:', result.data);
    }
  };

  const handleFulfill = async (reqId) => {
    const result = await fulfillRequirement(reqId, 'client@email.com');
    if (result.success) {
      console.log('Requirement fulfilled');
    }
  };

  return (
    <div>
      <h2>Requirements ({stats?.fulfillmentRate}% complete)</h2>
      {requirements.map(req => (
        <div key={req.id}>
          <h3>{req.title}</h3>
          {!req.isFulfilled && (
            <button onClick={() => handleFulfill(req.id)}>
              Mark as Fulfilled
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### useProposalPackages

Manages proposal packages and their relationships.

```javascript
import { useProposalPackages } from '../hooks/useProposalExtended';

function PackagesPanel({ proposalId }) {
  const {
    packages,
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage,
    addDeliverableToPackage,
    removeDeliverableFromPackage,
    refresh
  } = useProposalPackages(proposalId);

  const handleCreatePackage = async () => {
    const result = await createPackage(
      {
        name: 'Starter Package',
        description: 'Perfect for small projects',
        discount_percentage: 10,
        is_featured: true,
        badge_text: 'Most Popular'
      },
      ['deliverable-1', 'deliverable-2'], // deliverable IDs
      ['requirement-1', 'requirement-2']  // requirement IDs
    );

    if (result.success) {
      console.log('Package created with pricing:', result.data);
    }
  };

  const handleAddDeliverable = async (packageId, deliverableId) => {
    await addDeliverableToPackage(packageId, deliverableId, {
      price_override: 1200.00, // Optional
      is_required_in_package: true
    });
  };

  return (
    <div>
      {packages.map(pkg => (
        <div key={pkg.id}>
          <h3>{pkg.name}</h3>
          <p>Price: ${pkg.finalPrice}</p>
          {pkg.isFeatured && <span>{pkg.badgeText}</span>}
        </div>
      ))}
    </div>
  );
}
```

### useProjects

Manages projects for a customer.

```javascript
import { useProjects } from '../hooks/useProposalExtended';

function ProjectsList({ customerId }) {
  const {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh
  } = useProjects(customerId);

  const handleCreate = async () => {
    const result = await createProject({
      name: 'New Website',
      description: 'E-commerce website',
      budget: 15000,
      status: 'active'
    });

    if (result.success) {
      console.log('Project created:', result.data);
    }
  };

  return (
    <div>
      {projects.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          <p>Status: {project.status}</p>
          <p>Budget: ${project.budget}</p>
        </div>
      ))}
    </div>
  );
}
```

### useCompleteProposal

Fetches all extended proposal data in one hook.

```javascript
import { useCompleteProposal } from '../hooks/useProposalExtended';

function ProposalDashboard({ proposalId }) {
  const {
    requirements,
    packages,
    requirementStats,
    subscriptionMRR,
    loading,
    error,
    refresh
  } = useCompleteProposal(proposalId);

  return (
    <div>
      <div>
        <h3>Requirements</h3>
        <p>{requirementStats?.fulfilled} of {requirementStats?.total} complete</p>
        <p>Fulfillment Rate: {requirementStats?.fulfillmentRate}%</p>
      </div>

      <div>
        <h3>Packages</h3>
        {packages.map(pkg => (
          <div key={pkg.id}>{pkg.name} - ${pkg.finalPrice}</div>
        ))}
      </div>

      <div>
        <h3>Subscription Revenue</h3>
        <p>Monthly Recurring Revenue: ${subscriptionMRR?.totalMRR}</p>
        <p>Active Subscriptions: {subscriptionMRR?.subscriptionCount}</p>
      </div>
    </div>
  );
}
```

---

## Usage Examples

### Complete Workflow Example

```javascript
// 1. Create a project
import { createProject } from '../api/proposalExtended';

const projectResult = await createProject({
  customer_id: 'customer-123',
  name: 'Website Redesign 2025',
  budget: 20000
});

const projectId = projectResult.data.id;

// 2. Create a proposal for the project
import { createProposal } from '../api/proposals';

const proposalResult = await createProposal({
  project_id: projectId,
  customer_id: 'customer-123',
  title: 'Website Redesign Proposal',
  description: 'Modern, responsive website with CMS'
});

const proposalId = proposalResult.data.id;

// 3. Add deliverables (including subscription)
import { addProposalDeliverable } from '../api/proposals';

await addProposalDeliverable(proposalId, {
  title: 'Website Design & Development',
  type: 'fixed',
  price: 12000
});

await addProposalDeliverable(proposalId, {
  title: 'Monthly Support & Maintenance',
  type: 'subscription',
  price: 500,
  billing_interval: 'monthly'
});

// 4. Add requirements
import { createProposalRequirement } from '../api/proposalExtended';

await createProposalRequirement({
  proposal_id: proposalId,
  title: 'Provide brand guidelines',
  category: 'documentation',
  priority: 'high'
});

await createProposalRequirement({
  proposal_id: proposalId,
  title: 'Grant hosting access',
  category: 'access',
  priority: 'critical'
});

// 5. Create packages
import { createCompletePackage } from '../api/proposalExtended';

await createCompletePackage(
  proposalId,
  {
    name: 'Complete Package',
    description: 'Everything included',
    discount_percentage: 15,
    is_featured: true,
    badge_text: 'Best Value'
  },
  ['deliverable-1', 'deliverable-2'], // All deliverables
  ['requirement-1', 'requirement-2']  // All requirements
);
```

---

## Migration Guide

### Running the Migration

1. Ensure you have Supabase CLI installed
2. Navigate to your project directory
3. Run the migration:

```bash
# Apply the migration to your Supabase instance
supabase db push

# Or manually run the SQL file
psql -h <your-host> -U <your-user> -d <your-db> -f supabase/migrations/001_proposals_schema_update.sql
```

### Updating Existing Code

#### Before (Old API):
```javascript
// Old: Deliverables only supported 'fixed' and 'hourly'
await addProposalDeliverable(proposalId, {
  title: 'Monthly Support',
  type: 'fixed', // Had to use fixed type
  price: 500
});
```

#### After (New API):
```javascript
// New: Full subscription support
await addProposalDeliverable(proposalId, {
  title: 'Monthly Support',
  type: 'subscription', // Now properly typed
  price: 500,
  billing_interval: 'monthly'
});
```

### Data Migration Script

If you have existing proposals without projects:

```javascript
// Create default project for existing proposals
async function migrateExistingProposals() {
  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .is('project_id', null);

  for (const proposal of proposals) {
    // Create a project for each proposal
    const { data: project } = await supabase
      .from('projects')
      .insert({
        customer_id: proposal.customer_id,
        name: `Project for ${proposal.title}`,
        status: 'active'
      })
      .select()
      .single();

    // Update proposal with project_id
    await supabase
      .from('proposals')
      .update({ project_id: project.id })
      .eq('id', proposal.id);
  }
}
```

---

## Best Practices

### 1. Always Validate Data

```javascript
import { validateRequirementData } from '../services/proposalExtendedService';

const validation = validateRequirementData(formData);
if (!validation.isValid) {
  // Show errors to user
  setErrors(validation.errors);
  return;
}

// Proceed with creation
await createRequirement(formData);
```

### 2. Use Hooks for State Management

```javascript
// ✅ Good: Use hooks for automatic state management
const { requirements, loading } = useProposalRequirements(proposalId);

// ❌ Bad: Manual API calls and state management
const [requirements, setRequirements] = useState([]);
const fetchReqs = async () => {
  const result = await fetchProposalRequirements(proposalId);
  setRequirements(result.data);
};
```

### 3. Handle Errors Gracefully

```javascript
const { error, refresh } = useProposalPackages(proposalId);

if (error) {
  return (
    <div>
      <p>Error loading packages: {error}</p>
      <button onClick={refresh}>Retry</button>
    </div>
  );
}
```

### 4. Calculate Prices Automatically

```javascript
// Let the service calculate prices based on deliverables
const result = await createPackageWithPricing(
  proposalId,
  { name: 'Pro Package', discount_percentage: 10 },
  deliverableIds,
  requirementIds
);
// Prices are calculated automatically
```

---

## Troubleshooting

### Issue: Requirements not loading

**Solution**: Check that the proposal_id is valid and the proposal exists.

```javascript
// Verify proposal exists first
const { data: proposal } = await fetchProposal(proposalId);
if (!proposal) {
  console.error('Proposal not found');
  return;
}

// Then fetch requirements
const { requirements } = useProposalRequirements(proposalId);
```

### Issue: Package pricing incorrect

**Solution**: Use the service layer's price calculation:

```javascript
import { calculatePackagePrice } from '../services/proposalExtendedService';

// Fetch deliverables
const deliverables = await fetchPackageDeliverables(packageId);

// Calculate pricing
const pricing = calculatePackagePrice(deliverables.data, discountPercentage);

// Update package with correct pricing
await updateProposalPackage(packageId, {
  base_price: pricing.basePrice,
  final_price: pricing.finalPrice
});
```

### Issue: Subscription MRR not calculating

**Solution**: Ensure deliverables have correct billing_interval:

```javascript
// ❌ Wrong: Missing billing interval
{
  type: 'subscription',
  price: 500
  // Missing billing_interval!
}

// ✅ Correct: Include billing interval
{
  type: 'subscription',
  price: 500,
  billing_interval: 'monthly'
}
```

---

## Support

For questions or issues:
1. Check the [API Reference](#api-reference) for correct function signatures
2. Review [Usage Examples](#usage-examples) for common patterns
3. See [Migration Guide](#migration-guide) for upgrade instructions

## Changelog

### Version 1.0.0 (2025-01-05)
- Initial release
- Added projects table
- Added proposal requirements
- Added proposal packages
- Added subscription deliverable support
- Created comprehensive API, services, and hooks
