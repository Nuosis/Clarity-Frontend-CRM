# Client-Facing Product API Implementation Guide

**Document Version:** 1.0
**Date:** 2025-12-10
**Purpose:** Guide for external development teams building client-facing product configuration UIs

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Progressive Product Presentation Pattern](#progressive-product-presentation-pattern)
6. [Implementation Examples](#implementation-examples)
7. [Validation Rules](#validation-rules)
8. [Edge Cases](#edge-cases)

---

## Overview

This system supports complex product configurations with:
- **One-time purchases** (setup fees, equipment)
- **Subscription products** with usage-based billing
- **Product relationships** (prerequisites, add-ons, bundles, pricing tiers)
- **Progressive disclosure UI pattern** (show only what's relevant at each step)

### Key Principle: Progressive Presentation

**DO NOT** show all products at once. Instead:
1. Show only "root" products (products without prerequisites)
2. As user selects a product, reveal its related products
3. Guide user through required choices before showing optional add-ons

---

## Core Concepts

### Product Types

#### 1. One-Time Products
Products purchased once (e.g., setup fees, equipment).

```json
{
  "is_one_time": true,
  "is_subscription": false,
  "price": 500.00
}
```

**Display:** `$500.00 (one-time)`

#### 2. Subscription Products
Recurring billing with optional usage metering.

```json
{
  "is_subscription": true,
  "subscription_frequency": "monthly",
  "price": 60.00,
  "included_units": 180,
  "unit_type": "minutes",
  "overage_rate": 0.75
}
```

**Display:** `$60.00/month - Includes 180 minutes, $0.75 per additional minute`

#### 3. Pay-As-You-Go Subscriptions
Subscription with no included usage (user only pays if they use it).

```json
{
  "is_subscription": true,
  "subscription_frequency": "weekly",
  "price": 5.00,
  "included_units": 0,
  "unit_type": "minutes",
  "overage_rate": 1.00
}
```

**Display:** `$5.00/week - Pay-as-you-go, $1.00 per minute (no charge if unused)`

**Important:** When `included_units = 0`, the user is NOT charged the base price if they don't use the service.

---

## API Endpoints

### Base URL
```
https://api.claritybusinesssolutions.ca
```

### Authentication
All requests require HMAC-SHA256 authentication:
```
Authorization: Bearer {signature}.{timestamp}
```

See backend team for authentication implementation details.

---

### 1. Get All Products

**Endpoint:** `GET /supabase/products/select`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "AI Receptionist",
      "price": 500.00,
      "description": "AI-powered phone receptionist",
      "is_one_time": true,
      "is_subscription": false,
      "subscription_frequency": null,
      "included_units": 0,
      "unit_type": null,
      "overage_rate": 0,
      "metadata": {},
      "created_at": "2025-12-10T00:00:00Z",
      "updated_at": "2025-12-10T00:00:00Z"
    }
  ]
}
```

---

### 2. Get Product Relationships

**Endpoint:** `GET /supabase/products_products/select?parent_product_id={productId}`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "parent_product_id": "parent-uuid",
      "child_product_id": "child-uuid",
      "relationship_type": "prerequisite",
      "is_required": true,
      "quantity_multiplier": 1,
      "price_override": null,
      "display_order": 0,
      "exclusive_group": null
    }
  ]
}
```

---

## Data Models

### Products Table Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Primary key |
| `name` | text | No | Product name |
| `price` | numeric(10,2) | No | Base price in USD |
| `description` | text | Yes | Product description |
| `is_subscription` | boolean | No | Is this a recurring subscription? (default: false) |
| `subscription_frequency` | text | Yes | Billing cycle: 'weekly', 'monthly', 'yearly' |
| `included_units` | integer | No | Units included in base price (0 = pay-as-you-go) |
| `unit_type` | text | Yes | Type of unit: 'minutes', 'hours', 'API calls', etc. |
| `overage_rate` | numeric(10,2) | No | Cost per additional unit beyond included amount |
| `is_one_time` | boolean | No | Is this a one-time purchase? (default: false) |
| `metadata` | jsonb | No | Additional metadata (default: {}) |
| `created_at` | timestamp | No | Record creation timestamp |
| `updated_at` | timestamp | No | Last update timestamp |

### Products_Products Table Schema (Relationships)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Primary key |
| `parent_product_id` | uuid | No | The main product |
| `child_product_id` | uuid | No | The related product |
| `relationship_type` | text | No | Type: 'addon', 'prerequisite', 'bundle_item', 'upsell', 'required_choice' |
| `is_required` | boolean | No | Must user purchase this? (default: false) |
| `quantity_multiplier` | integer | No | Auto-quantity multiplier (default: 1) |
| `price_override` | numeric(10,2) | Yes | Special bundle pricing (overrides child's price) |
| `display_order` | integer | No | Sort order for UI display (default: 0) |
| `exclusive_group` | text | Yes | Groups mutually exclusive options (e.g., 'pricing_tiers') |

---

## Relationship Types

### 1. `prerequisite`
**Must be purchased BEFORE the parent product.**

**Example:** Setup fee is prerequisite for AI Receptionist service.

**UI Pattern:**
```
[AI Receptionist] - $0/month
  ⚠️ Requires: Setup Fee ($500 one-time)
  [ ] Include Setup Fee
```

### 2. `required_choice`
**Customer MUST pick one option from an exclusive group.**

**Example:** AI Receptionist has 3 pricing tiers - user must pick one.

**UI Pattern:**
```
[AI Receptionist Selected]

Choose Your Pricing Plan (required):
○ Pay-As-You-Go - $5/week ($1.00/min, no charge if unused)
○ Small Business - $60/month (180 min included, $0.75/min overage)
○ Medium Business - $100/month (300 min included, $0.50/min overage)
```

**Important:** Products in the same `exclusive_group` are mutually exclusive.

### 3. `addon`
**Optional products that enhance the parent.**

**Example:** Call recording addon for AI Receptionist.

**UI Pattern:**
```
[AI Receptionist Selected]

Optional Add-ons:
[ ] Call Recording - $10/month
[ ] SMS Notifications - $5/month
```

### 4. `bundle_item`
**Products automatically included in the parent.**

**Example:** AI Receptionist bundle includes dashboard access.

**UI Pattern:**
```
[AI Receptionist Pro Bundle] - $150/month

Includes:
✓ AI Receptionist Service
✓ Advanced Dashboard
✓ Priority Support
```

### 5. `upsell`
**Suggested premium alternatives.**

**Example:** Enterprise plan as upsell from Small Business plan.

**UI Pattern:**
```
[Small Business Plan Selected] - $60/month

💡 Upgrade Available:
Enterprise Plan - $200/month (save 25%)
  • 1000 minutes included
  • Dedicated account manager
  • Custom integrations
```

---

## Progressive Product Presentation Pattern

### Step 1: Show Only Root Products

**Root Product Definition:** Products that have NO prerequisites or are NOT child products in a `required_choice` relationship.

**Query Logic:**
```sql
-- Get all products
SELECT * FROM products;

-- Get all child product IDs that are prerequisites or required choices
SELECT DISTINCT child_product_id
FROM products_products
WHERE relationship_type IN ('prerequisite', 'required_choice');

-- Root products = All products - Child products from above query
```

**Example Root Products:**
- AI Receptionist (has pricing tiers as children, but itself is not a child)
- Website Hosting (standalone product)
- Email Marketing (standalone product)

---

### Step 2: User Selects a Product

When user clicks "Configure AI Receptionist", fetch its relationships:

**Request:**
```
GET /supabase/products_products/select?parent_product_id={AI_RECEPTIONIST_ID}
```

**Response Analysis:**
```json
{
  "data": [
    {
      "relationship_type": "prerequisite",
      "child_product_id": "setup-fee-id",
      "is_required": true
    },
    {
      "relationship_type": "required_choice",
      "child_product_id": "payg-tier-id",
      "exclusive_group": "pricing_tiers",
      "is_required": true
    },
    {
      "relationship_type": "required_choice",
      "child_product_id": "small-biz-tier-id",
      "exclusive_group": "pricing_tiers",
      "is_required": true
    },
    {
      "relationship_type": "addon",
      "child_product_id": "call-recording-id",
      "is_required": false
    }
  ]
}
```

---

### Step 3: Present in Priority Order

**UI Flow:**

#### A. Show Prerequisites First (Blocking)
```
⚠️ Required Before Setup

[✓] Setup Fee - $500 (one-time)
    Required to activate AI Receptionist

[Continue] (disabled until checked)
```

#### B. Show Required Choices (Blocking)
```
Choose Your Pricing Plan *

The following options are mutually exclusive - select one:

○ Pay-As-You-Go
  $5.00/week - No commitment
  Pay only for minutes used: $1.00/minute
  Perfect for: Occasional use

○ Small Business
  $60.00/month - Best value
  Includes 180 minutes (~3 hours)
  Overage: $0.75/minute
  Perfect for: Regular daily use

○ Medium Business
  $100.00/month - Most popular
  Includes 300 minutes (~5 hours)
  Overage: $0.50/minute
  Perfect for: High-volume businesses

[Continue] (disabled until one selected)
```

#### C. Show Optional Add-ons (Non-blocking)
```
Enhance Your Service (optional)

[ ] Call Recording - $10/month
    Record and archive all calls

[ ] SMS Notifications - $5/month
    Get text alerts for missed calls

[Continue] or [Add to Cart]
```

---

## Implementation Examples

### Example 1: Basic Product Display

```javascript
// Fetch root products
async function getRootProducts() {
  // 1. Get all products
  const allProducts = await fetch('/supabase/products/select');

  // 2. Get child product IDs from prerequisite/required_choice relationships
  const childProductIds = await fetch(
    '/supabase/products_products/select?relationship_type=in.(prerequisite,required_choice)'
  ).then(res => res.data.map(r => r.child_product_id));

  // 3. Filter out child products
  return allProducts.data.filter(p => !childProductIds.includes(p.id));
}

// Display root products
function displayRootProducts(products) {
  return products.map(product => ({
    id: product.id,
    name: product.name,
    displayPrice: formatPrice(product),
    description: product.description
  }));
}

function formatPrice(product) {
  let price = `$${product.price.toFixed(2)}`;

  if (product.is_subscription && product.subscription_frequency) {
    price += `/${product.subscription_frequency}`;
  }

  if (product.is_one_time) {
    price += ' (one-time)';
  }

  // Add subscription details
  if (product.is_subscription) {
    if (product.included_units > 0) {
      price += ` - Includes ${product.included_units} ${product.unit_type}`;
    } else {
      price += ' - Pay-as-you-go (no charge if unused)';
    }

    if (product.overage_rate > 0) {
      price += `, $${product.overage_rate.toFixed(2)} per additional ${product.unit_type}`;
    }
  }

  return price;
}
```

---

### Example 2: Progressive Relationship Loading

```javascript
async function configureProduct(productId) {
  // Fetch all relationships for this product
  const relationships = await fetch(
    `/supabase/products_products/select?parent_product_id=${productId}`
  );

  // Fetch full product details for all child products
  const childProductIds = relationships.data.map(r => r.child_product_id);
  const childProducts = await fetch(
    `/supabase/products/select?id=in.(${childProductIds.join(',')})`
  );

  // Create lookup map
  const productMap = Object.fromEntries(
    childProducts.data.map(p => [p.id, p])
  );

  // Group relationships by type and priority
  const grouped = {
    prerequisites: [],
    requiredChoices: {},
    addons: [],
    bundleItems: [],
    upsells: []
  };

  relationships.data.forEach(rel => {
    const product = productMap[rel.child_product_id];
    const item = { ...rel, product };

    switch (rel.relationship_type) {
      case 'prerequisite':
        grouped.prerequisites.push(item);
        break;

      case 'required_choice':
        const group = rel.exclusive_group || 'default';
        if (!grouped.requiredChoices[group]) {
          grouped.requiredChoices[group] = [];
        }
        grouped.requiredChoices[group].push(item);
        break;

      case 'addon':
        grouped.addons.push(item);
        break;

      case 'bundle_item':
        grouped.bundleItems.push(item);
        break;

      case 'upsell':
        grouped.upsells.push(item);
        break;
    }
  });

  // Sort by display_order
  Object.keys(grouped).forEach(key => {
    if (Array.isArray(grouped[key])) {
      grouped[key].sort((a, b) => a.display_order - b.display_order);
    }
  });

  return grouped;
}
```

---

### Example 3: Rendering UI Steps

```javascript
function renderConfigurationSteps(productId, relationships) {
  const steps = [];
  let currentStep = 0;

  // Step 1: Prerequisites
  if (relationships.prerequisites.length > 0) {
    steps.push({
      type: 'prerequisites',
      title: 'Required Before Setup',
      blocking: true,
      items: relationships.prerequisites.map(rel => ({
        id: rel.child_product_id,
        name: rel.product.name,
        price: formatPrice(rel.product),
        required: rel.is_required,
        selected: false
      }))
    });
  }

  // Step 2: Required Choices (grouped)
  Object.entries(relationships.requiredChoices).forEach(([groupName, items]) => {
    steps.push({
      type: 'required_choice',
      title: `Choose Your ${groupName.replace('_', ' ')}`,
      blocking: true,
      exclusive: true,
      items: items.map(rel => ({
        id: rel.child_product_id,
        name: rel.product.name,
        price: formatPrice(rel.product),
        description: rel.product.description,
        priceOverride: rel.price_override,
        selected: false
      }))
    });
  });

  // Step 3: Optional Add-ons
  if (relationships.addons.length > 0) {
    steps.push({
      type: 'addons',
      title: 'Enhance Your Service (optional)',
      blocking: false,
      items: relationships.addons.map(rel => ({
        id: rel.child_product_id,
        name: rel.product.name,
        price: rel.price_override || rel.product.price,
        description: rel.product.description,
        selected: false
      }))
    });
  }

  // Step 4: Upsells (always last)
  if (relationships.upsells.length > 0) {
    steps.push({
      type: 'upsells',
      title: 'Upgrade Options',
      blocking: false,
      items: relationships.upsells.map(rel => ({
        id: rel.child_product_id,
        name: rel.product.name,
        price: rel.price_override || rel.product.price,
        description: rel.product.description,
        benefits: [] // Could be parsed from metadata
      }))
    });
  }

  return { steps, currentStep };
}
```

---

## Validation Rules

### 1. Prerequisites Must Be Satisfied

Before allowing user to proceed, verify all required prerequisites are selected:

```javascript
function validatePrerequisites(selections, prerequisites) {
  const requiredPrereqs = prerequisites.filter(p => p.is_required);
  const selectedIds = selections.map(s => s.productId);

  return requiredPrereqs.every(p =>
    selectedIds.includes(p.child_product_id)
  );
}
```

### 2. Exactly One Required Choice Per Group

For each `exclusive_group`, user must select exactly one option:

```javascript
function validateRequiredChoices(selections, requiredChoices) {
  return Object.entries(requiredChoices).every(([group, items]) => {
    const selectedInGroup = selections.filter(s =>
      items.some(i => i.child_product_id === s.productId)
    );
    return selectedInGroup.length === 1;
  });
}
```

### 3. No Conflicting Selections

User cannot select multiple products from same exclusive group:

```javascript
function validateNoConflicts(selections, allRelationships) {
  const groupedSelections = {};

  allRelationships.forEach(rel => {
    if (rel.exclusive_group && selections.some(s => s.productId === rel.child_product_id)) {
      if (!groupedSelections[rel.exclusive_group]) {
        groupedSelections[rel.exclusive_group] = [];
      }
      groupedSelections[rel.exclusive_group].push(rel.child_product_id);
    }
  });

  // Each group should have max 1 selection
  return Object.values(groupedSelections).every(arr => arr.length <= 1);
}
```

---

## Edge Cases

### 1. Pay-As-You-Go Billing (included_units = 0)

When `included_units = 0`, the pricing model is:
- **Base price charged:** Only if usage > 0 for that billing period
- **Overage rate applies:** To ALL usage (not just overages)

**Example:**
```json
{
  "price": 5.00,
  "subscription_frequency": "weekly",
  "included_units": 0,
  "overage_rate": 1.00
}
```

**Calculation:**
- Week 1: User uses 10 minutes → Charged $5 + ($1 × 10) = $15
- Week 2: User uses 0 minutes → Charged $0 (not $5)
- Week 3: User uses 1 minute → Charged $5 + ($1 × 1) = $6

### 2. Price Overrides in Bundles

When `price_override` is set, use that instead of child product's price:

```javascript
function getEffectivePrice(relationship, childProduct) {
  return relationship.price_override !== null
    ? relationship.price_override
    : childProduct.price;
}
```

### 3. Quantity Multipliers

When `quantity_multiplier > 1`, automatically add multiple units:

**Example:** Buying 5 licenses automatically adds 5 training sessions:
```json
{
  "parent_product_id": "software-license",
  "child_product_id": "training-session",
  "relationship_type": "bundle_item",
  "quantity_multiplier": 1
}
```

If user selects 5 licenses, they get 5 × 1 = 5 training sessions.

### 4. Products with Multiple Exclusive Groups

A product can have multiple exclusive groups (e.g., choose billing frequency AND support level):

```
Choose Billing Frequency (exclusive_group: "billing"):
○ Monthly - $100
○ Yearly - $1000 (save 17%)

Choose Support Level (exclusive_group: "support"):
○ Standard - $0
○ Premium - $50/month
```

User must make one selection from EACH group.

---

## Complete User Flow Example

### Scenario: User Configures AI Receptionist

#### Initial Screen (Root Products)
```
Available Products:

[AI Receptionist]
  AI-powered phone answering service
  Starting at $5/week
  [Configure] <-- User clicks here

[Website Hosting]
  Managed WordPress hosting
  $20/month
  [Configure]
```

#### Step 1: Prerequisites
```
Configuring: AI Receptionist

⚠️ Required Setup

Before we can activate your AI Receptionist, you'll need:

[✓] Setup Fee - $500.00 (one-time)
    Professional installation and configuration

Total Due Today: $500.00

[Continue]
```

#### Step 2: Required Choice (Pricing Tiers)
```
Configuring: AI Receptionist

Choose Your Pricing Plan *

○ Pay-As-You-Go - $5.00/week
  • No commitment, cancel anytime
  • No charge if unused
  • $1.00 per minute used
  Best for: Occasional use

● Small Business - $60.00/month <-- User selects this
  • 180 minutes included (~3 hours)
  • $0.75 per additional minute
  Best for: Regular daily calls

○ Medium Business - $100.00/month
  • 300 minutes included (~5 hours)
  • $0.50 per additional minute
  Best for: High call volume

[Continue]
```

#### Step 3: Optional Add-ons
```
Configuring: AI Receptionist

Enhance Your Service (optional)

[✓] Call Recording - $10.00/month <-- User selects
    Record and download all calls
    30-day storage included

[ ] SMS Notifications - $5.00/month
    Text alerts for missed calls

[ ] CRM Integration - $15.00/month
    Sync with Salesforce/HubSpot

[Add to Cart]
```

#### Final Cart Summary
```
Your Configuration:

AI Receptionist - Small Business Plan
  Base: $60.00/month
  Includes: 180 minutes
  Overage: $0.75/minute

Add-ons:
  + Call Recording: $10.00/month

One-Time Fees:
  + Setup Fee: $500.00

Monthly Total: $70.00/month
Due Today: $500.00 (setup) + $70.00 (first month) = $570.00

[Checkout]
```

---

## Summary for Client-Facing Developers

### Quick Implementation Checklist

1. ✅ **Fetch only root products** for initial display
   - Root = products NOT appearing as children in prerequisite/required_choice relationships

2. ✅ **Progressive disclosure** when user selects a product:
   - Show prerequisites first (blocking)
   - Show required choices second (blocking)
   - Show add-ons last (optional)

3. ✅ **Validate selections**:
   - All required prerequisites selected
   - Exactly one choice per exclusive_group
   - No conflicting selections

4. ✅ **Handle special pricing**:
   - Pay-as-you-go: included_units = 0 means no charge if unused
   - Price overrides: Use price_override when present
   - Display subscription details clearly

5. ✅ **User experience**:
   - Disable "Continue" until blocking requirements met
   - Show price breakdowns clearly
   - Explain what's included vs. what costs extra

---

## Support and Questions

For technical questions about this API:
- **Backend Team:** [backend contact]
- **API Documentation:** https://api.claritybusinesssolutions.ca/docs
- **Status Page:** [status page URL]

For schema change requests or new features:
- Submit via: Backend Change Request process
- Template: See `BACKEND_CHANGE_REQUEST_001_PRODUCT_SUBSCRIPTIONS.md`

---

**Document Maintained By:** Clarity CRM Team
**Last Updated:** 2025-12-10
