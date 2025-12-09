# Extended Proposal System - Implementation Quick Start

## Overview

This guide provides quick implementation examples for integrating the extended proposal system into your React components.

## Prerequisites

1. Run the database migration:
```bash
psql -h <your-host> -U <your-user> -d <your-db> -f supabase/migrations/001_proposals_schema_update.sql
```

2. Import the necessary modules:
```javascript
// API Layer
import * as extendedAPI from '../api/proposalExtended';

// Service Layer
import * as extendedService from '../services/proposalExtendedService';

// Hooks
import {
  useProposalRequirements,
  useProposalPackages,
  useProjects,
  useCompleteProposal
} from '../hooks/useProposalExtended';
```

---

## Component Examples

### 1. Requirements Manager Component

Create a component to manage client requirements:

```javascript
// src/components/proposals/RequirementsManager.jsx
import React, { useState } from 'react';
import { useProposalRequirements } from '../../hooks/useProposalExtended';

export default function RequirementsManager({ proposalId }) {
  const {
    requirements,
    stats,
    loading,
    error,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    fulfillRequirement
  } = useProposalRequirements(proposalId);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'content',
    priority: 'medium'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await createRequirement(formData);

    if (result.success) {
      setFormData({ title: '', description: '', category: 'content', priority: 'medium' });
      setShowForm(false);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleFulfill = async (requirementId) => {
    const fulfilledBy = prompt('Who fulfilled this requirement?');
    if (fulfilledBy) {
      await fulfillRequirement(requirementId, fulfilledBy);
    }
  };

  if (loading) return <div>Loading requirements...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="requirements-manager">
      <div className="header">
        <h2>Client Requirements</h2>
        {stats && (
          <div className="stats">
            <span>{stats.fulfilled} of {stats.total} completed</span>
            <span className="percentage">{stats.fulfillmentRate.toFixed(0)}%</span>
          </div>
        )}
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Requirement'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="requirement-form">
          <input
            type="text"
            placeholder="Requirement title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="content">Content</option>
            <option value="access">Access</option>
            <option value="assets">Assets</option>
            <option value="documentation">Documentation</option>
            <option value="credentials">Credentials</option>
            <option value="other">Other</option>
          </select>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="critical">Critical</option>
          </select>
          <button type="submit">Create Requirement</button>
        </form>
      )}

      <div className="requirements-list">
        {requirements.map((req) => (
          <div key={req.id} className={`requirement ${req.isFulfilled ? 'fulfilled' : 'pending'}`}>
            <div className="requirement-header">
              <h3>{req.title}</h3>
              <span className={`badge ${req.priority}`}>{req.priority}</span>
              <span className={`badge ${req.category}`}>{req.category}</span>
            </div>
            <p>{req.description}</p>

            {req.isFulfilled ? (
              <div className="fulfilled-info">
                ✓ Fulfilled by {req.fulfilledBy} on {new Date(req.fulfilledAt).toLocaleDateString()}
              </div>
            ) : (
              <div className="actions">
                <button onClick={() => handleFulfill(req.id)}>
                  Mark as Fulfilled
                </button>
                <button onClick={() => deleteRequirement(req.id)} className="danger">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Package Builder Component

Create packages with deliverables and requirements:

```javascript
// src/components/proposals/PackageBuilder.jsx
import React, { useState } from 'react';
import { useProposalPackages } from '../../hooks/useProposalExtended';

export default function PackageBuilder({ proposalId, availableDeliverables, availableRequirements }) {
  const {
    packages,
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage
  } = useProposalPackages(proposalId);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_percentage: 0,
    is_featured: false,
    badge_text: '',
    badge_color: '#4CAF50'
  });
  const [selectedDeliverables, setSelectedDeliverables] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await createPackage(
      formData,
      selectedDeliverables,
      selectedRequirements
    );

    if (result.success) {
      setShowForm(false);
      // Reset form
      setFormData({
        name: '',
        description: '',
        discount_percentage: 0,
        is_featured: false,
        badge_text: '',
        badge_color: '#4CAF50'
      });
      setSelectedDeliverables([]);
      setSelectedRequirements([]);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const toggleDeliverable = (deliverableId) => {
    setSelectedDeliverables(prev =>
      prev.includes(deliverableId)
        ? prev.filter(id => id !== deliverableId)
        : [...prev, deliverableId]
    );
  };

  const toggleRequirement = (requirementId) => {
    setSelectedRequirements(prev =>
      prev.includes(requirementId)
        ? prev.filter(id => id !== requirementId)
        : [...prev, requirementId]
    );
  };

  if (loading) return <div>Loading packages...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="package-builder">
      <div className="header">
        <h2>Proposal Packages</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Create Package'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="package-form">
          <h3>Package Details</h3>

          <input
            type="text"
            placeholder="Package name (e.g., 'Starter Package')"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <textarea
            placeholder="Package description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="form-row">
            <label>
              Discount %:
              <input
                type="number"
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
              />
            </label>

            <label>
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              />
              Featured Package
            </label>
          </div>

          {formData.is_featured && (
            <div className="form-row">
              <input
                type="text"
                placeholder="Badge text (e.g., 'Most Popular')"
                value={formData.badge_text}
                onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
              />
              <input
                type="color"
                value={formData.badge_color}
                onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
              />
            </div>
          )}

          <h3>Select Deliverables</h3>
          <div className="selection-grid">
            {availableDeliverables.map((deliverable) => (
              <label key={deliverable.id} className="checkbox-card">
                <input
                  type="checkbox"
                  checked={selectedDeliverables.includes(deliverable.id)}
                  onChange={() => toggleDeliverable(deliverable.id)}
                />
                <div>
                  <strong>{deliverable.title}</strong>
                  <span>${deliverable.price}</span>
                </div>
              </label>
            ))}
          </div>

          <h3>Select Requirements</h3>
          <div className="selection-grid">
            {availableRequirements.map((requirement) => (
              <label key={requirement.id} className="checkbox-card">
                <input
                  type="checkbox"
                  checked={selectedRequirements.includes(requirement.id)}
                  onChange={() => toggleRequirement(requirement.id)}
                />
                <div>
                  <strong>{requirement.title}</strong>
                </div>
              </label>
            ))}
          </div>

          <button type="submit" className="create-button">
            Create Package
          </button>
        </form>
      )}

      <div className="packages-grid">
        {packages.map((pkg) => (
          <div key={pkg.id} className={`package-card ${pkg.isFeatured ? 'featured' : ''}`}>
            {pkg.isFeatured && (
              <div
                className="badge"
                style={{ backgroundColor: pkg.badgeColor }}
              >
                {pkg.badgeText}
              </div>
            )}

            <h3>{pkg.name}</h3>
            <p>{pkg.description}</p>

            <div className="pricing">
              {pkg.discountPercentage > 0 && (
                <span className="original-price">${pkg.basePrice.toFixed(2)}</span>
              )}
              <span className="final-price">${pkg.finalPrice.toFixed(2)}</span>
              {pkg.discountPercentage > 0 && (
                <span className="discount">Save {pkg.discountPercentage}%</span>
              )}
            </div>

            <div className="package-contents">
              <div>
                <strong>Deliverables:</strong> {pkg.deliverables?.length || 0}
              </div>
              <div>
                <strong>Requirements:</strong> {pkg.requirements?.length || 0}
              </div>
            </div>

            <button
              onClick={() => deletePackage(pkg.id)}
              className="delete-button"
            >
              Delete Package
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Subscription Dashboard Component

Display subscription metrics:

```javascript
// src/components/proposals/SubscriptionDashboard.jsx
import React from 'react';
import { useCompleteProposal } from '../../hooks/useProposalExtended';

export default function SubscriptionDashboard({ proposalId }) {
  const {
    subscriptionMRR,
    loading,
    error
  } = useCompleteProposal(proposalId);

  if (loading) return <div>Loading subscription data...</div>;
  if (error) return <div>Error: {error}</div>;

  if (!subscriptionMRR || subscriptionMRR.subscriptionCount === 0) {
    return (
      <div className="subscription-dashboard empty">
        <p>No subscription deliverables in this proposal.</p>
      </div>
    );
  }

  return (
    <div className="subscription-dashboard">
      <h2>Subscription Revenue</h2>

      <div className="metrics">
        <div className="metric-card">
          <div className="metric-value">${subscriptionMRR.totalMRR.toFixed(2)}</div>
          <div className="metric-label">Monthly Recurring Revenue</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{subscriptionMRR.subscriptionCount}</div>
          <div className="metric-label">Active Subscriptions</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">${(subscriptionMRR.totalMRR * 12).toFixed(2)}</div>
          <div className="metric-label">Annual Recurring Revenue</div>
        </div>
      </div>

      <h3>Breakdown</h3>
      <table className="subscription-breakdown">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Billing</th>
            <th>Price</th>
            <th>Monthly Equivalent</th>
          </tr>
        </thead>
        <tbody>
          {subscriptionMRR.breakdown.map((sub) => (
            <tr key={sub.id}>
              <td>{sub.title}</td>
              <td>{sub.billingInterval}</td>
              <td>${sub.price.toFixed(2)}</td>
              <td>${sub.monthlyEquivalent.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 4. Projects Selector Component

Select or create a project for a proposal:

```javascript
// src/components/proposals/ProjectSelector.jsx
import React, { useState } from 'react';
import { useProjects } from '../../hooks/useProposalExtended';

export default function ProjectSelector({ customerId, onProjectSelect }) {
  const {
    projects,
    loading,
    error,
    createProject
  } = useProjects(customerId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: 0
  });

  const handleCreate = async (e) => {
    e.preventDefault();

    const result = await createProject(formData);

    if (result.success) {
      onProjectSelect(result.data);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', budget: 0 });
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="project-selector">
      <h3>Select Project</h3>

      {projects.length > 0 ? (
        <div className="projects-list">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => onProjectSelect(project)}
            >
              <h4>{project.name}</h4>
              <p>{project.description}</p>
              <div className="project-meta">
                <span>Status: {project.status}</span>
                {project.budget && <span>Budget: ${project.budget}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No projects found for this customer.</p>
      )}

      {showCreateForm ? (
        <form onSubmit={handleCreate} className="create-project-form">
          <input
            type="text"
            placeholder="Project name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <textarea
            placeholder="Project description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <input
            type="number"
            placeholder="Budget"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) })}
          />
          <div className="form-actions">
            <button type="submit">Create Project</button>
            <button type="button" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowCreateForm(true)}>
          + Create New Project
        </button>
      )}
    </div>
  );
}
```

---

## Integration with Existing Proposal Form

Update your existing proposal creation form to include project selection:

```javascript
// src/components/proposals/ProposalCreationForm.jsx
import React, { useState } from 'react';
import ProjectSelector from './ProjectSelector';
import RequirementsManager from './RequirementsManager';
import PackageBuilder from './PackageBuilder';

export default function ProposalCreationForm({ customerId }) {
  const [step, setStep] = useState(1);
  const [selectedProject, setSelectedProject] = useState(null);
  const [proposalId, setProposalId] = useState(null);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setStep(2);
  };

  const handleProposalCreate = async (proposalData) => {
    // Create proposal with project_id
    const result = await createProposal({
      ...proposalData,
      project_id: selectedProject.id,
      customer_id: customerId
    });

    if (result.success) {
      setProposalId(result.data.id);
      setStep(3);
    }
  };

  return (
    <div className="proposal-creation-wizard">
      {step === 1 && (
        <ProjectSelector
          customerId={customerId}
          onProjectSelect={handleProjectSelect}
        />
      )}

      {step === 2 && (
        <div>
          <h2>Create Proposal for {selectedProject.name}</h2>
          {/* Your existing proposal form */}
          <button onClick={handleProposalCreate}>Create Proposal</button>
        </div>
      )}

      {step === 3 && proposalId && (
        <div>
          <RequirementsManager proposalId={proposalId} />
          <PackageBuilder
            proposalId={proposalId}
            availableDeliverables={[/* your deliverables */]}
            availableRequirements={[/* your requirements */]}
          />
        </div>
      )}
    </div>
  );
}
```

---

## Testing Your Implementation

### 1. Test Requirements Flow

```javascript
// Test creating and managing requirements
const testRequirements = async (proposalId) => {
  // Create requirement
  const result = await createProposalRequirement({
    proposal_id: proposalId,
    title: 'Test Requirement',
    category: 'content',
    priority: 'high'
  });

  console.log('Created:', result.data);

  // Fulfill requirement
  await fulfillProposalRequirement(result.data.id, 'test@example.com');

  // Fetch all requirements
  const requirements = await fetchProposalRequirements(proposalId);
  console.log('All requirements:', requirements.data);
};
```

### 2. Test Package Creation

```javascript
// Test creating a package with pricing
const testPackage = async (proposalId) => {
  const result = await createPackageWithPricing(
    proposalId,
    {
      name: 'Test Package',
      description: 'Test description',
      discount_percentage: 15
    },
    ['deliverable-id-1', 'deliverable-id-2'],
    ['requirement-id-1']
  );

  console.log('Package created:', result.data);
  console.log('Final price:', result.data.finalPrice);
};
```

### 3. Test Subscription Calculations

```javascript
// Test MRR calculations
const testMRR = () => {
  const deliverables = [
    { type: 'subscription', price: 500, billingInterval: 'monthly' },
    { type: 'subscription', price: 3000, billingInterval: 'yearly' },
    { type: 'fixed', price: 5000 }
  ];

  const mrr = calculateSubscriptionMRR(deliverables);
  console.log('Total MRR:', mrr.totalMRR); // Should be 750 (500 + 3000/12)
};
```

---

## Next Steps

1. **Run the migration** to create the new tables
2. **Import the necessary modules** into your components
3. **Update your proposal creation flow** to include project selection
4. **Add requirements and packages** to your proposal management interface
5. **Test thoroughly** with real data

## Common Pitfalls

### ❌ Forgetting to link proposals to projects
```javascript
// Wrong: No project_id
await createProposal({ title: 'My Proposal', customer_id: 'cust-123' });

// Correct: Include project_id
await createProposal({
  title: 'My Proposal',
  customer_id: 'cust-123',
  project_id: 'proj-456'
});
```

### ❌ Not setting billing interval for subscriptions
```javascript
// Wrong: Missing billing_interval
{ type: 'subscription', price: 500 }

// Correct: Include billing_interval
{ type: 'subscription', price: 500, billing_interval: 'monthly' }
```

### ❌ Not refreshing data after mutations
```javascript
// Wrong: Data becomes stale
await createRequirement(data);
// Component shows old data

// Correct: Refresh after creation
await createRequirement(data);
await refresh(); // Hook automatically refreshes
```

---

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify the migration ran successfully
3. Ensure all foreign keys are valid
4. Review the [full documentation](./EXTENDED_PROPOSAL_SYSTEM.md)
