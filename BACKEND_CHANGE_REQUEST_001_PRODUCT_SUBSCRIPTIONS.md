# Backend Change Request #001 - Product Subscription Features

**Date:** 2025-12-10
**Requested By:** Frontend Team (via Claude Code)
**Priority:** Medium
**Status:** Pending Backend Team Approval

---

## Summary

Request to add subscription billing and usage-based pricing fields to the `products` table, and add an exclusive grouping field to the `products_products` relationship table.

---

## Business Requirement

Support subscription-based products with usage-based billing for products like "AI Receptionist" which have:
- Weekly/monthly/yearly billing cycles
- Included units (e.g., 180 minutes included)
- Pay-as-you-go options (0 included units = no charge if unused)
- Overage rates (e.g., $0.75 per additional minute)
- Mutually exclusive pricing tiers (customer must pick one option)

---

## Requested Database Changes

### 1. Products Table - Add Subscription Fields

```sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_subscription boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_frequency text,
ADD COLUMN IF NOT EXISTS included_units integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_type text,
ADD COLUMN IF NOT EXISTS overage_rate numeric(10,2),
ADD COLUMN IF NOT EXISTS is_one_time boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
```

**Field Descriptions:**
- `is_subscription` - Boolean flag indicating if product is subscription-based
- `subscription_frequency` - Values: 'weekly', 'monthly', 'yearly'
- `included_units` - Number of units included in base price (0 = pay-as-you-go)
- `unit_type` - Type of unit (e.g., 'minutes', 'hours', 'API calls')
- `overage_rate` - Cost per additional unit beyond included amount
- `is_one_time` - Boolean flag for one-time purchases (setup fees, etc.)
- `metadata` - JSONB field for future extensibility

### 2. Products_Products Table - Add Exclusive Group Field

```sql
ALTER TABLE products_products
ADD COLUMN IF NOT EXISTS exclusive_group text;
```

**Field Description:**
- `exclusive_group` - Groups mutually exclusive products (e.g., 'pricing_tiers')
- Products in the same exclusive_group are "pick one of many" options
- Used with `relationship_type = 'required_choice'`

---

## Use Case Example: AI Receptionist

**Parent Product:** AI Receptionist
**Setup Fee:** $500 (one-time, prerequisite)

**Pricing Tiers (exclusive_group = 'pricing_tiers'):**

1. **Pay-As-You-Go** - $5/week
   - `included_units`: 0
   - `overage_rate`: $1.00
   - No charge if unused

2. **Small Business** - $60/month
   - `included_units`: 180 (minutes)
   - `overage_rate`: $0.75

3. **Medium Business** - $100/month
   - `included_units`: 300 (minutes)
   - `overage_rate`: $0.50

---

## Frontend Implementation Status

The following frontend components have been built **assuming these schema changes**:

✅ **ProductForm.jsx** - Subscription configuration UI
✅ **ProductDetails.jsx** - Subscription details display
✅ **RelatedProductsSection.jsx** - Exclusive group handling
✅ **productService.js** - Reads new fields (needs schema to exist)
✅ **productRelationshipsService.js** - Handles exclusive_group field

**Status:** Frontend code is ready but **will not function** until backend schema is updated.

---

## Migration Impact Assessment

**Backward Compatibility:**
- ✅ All new columns have DEFAULT values
- ✅ Existing products will have `is_subscription = false` by default
- ✅ Existing relationships will have `exclusive_group = NULL`
- ✅ No breaking changes to existing API contracts

**Data Integrity:**
- ✅ No foreign key changes
- ✅ No existing data modification required
- ✅ All new fields are nullable or have safe defaults

---

## Testing Requirements

**Backend Team Should Test:**
1. ✅ Schema migration applies cleanly to production database
2. ✅ Default values are properly set for existing records
3. ✅ No performance impact on existing product queries
4. ✅ JSONB metadata field is properly indexed if needed
5. ✅ API endpoints return new fields without errors

**Frontend Will Test:**
1. Product creation with subscription fields
2. Product updates with subscription data
3. Exclusive group relationships (required_choice type)
4. Display of subscription pricing in UI
5. Validation of subscription configuration

---

## API Contract Changes

**GET /supabase/products/select**
```json
{
  "id": "uuid",
  "name": "AI Receptionist - Small Business",
  "price": 60.00,
  "description": "...",

  // NEW FIELDS
  "is_subscription": true,
  "subscription_frequency": "monthly",
  "included_units": 180,
  "unit_type": "minutes",
  "overage_rate": 0.75,
  "is_one_time": false,
  "metadata": {}
}
```

**POST /supabase/products/insert**
**PUT /supabase/products/update**
- Accept new subscription fields in request body
- Validate `subscription_frequency` enum if provided
- Validate numeric fields are non-negative

**GET /supabase/products_products/select**
```json
{
  "id": "uuid",
  "parent_product_id": "uuid",
  "child_product_id": "uuid",
  "relationship_type": "required_choice",

  // NEW FIELD
  "exclusive_group": "pricing_tiers"
}
```

---

## Alternative Approaches Considered

### Option 1: Store in Metadata JSONB (Not Recommended)
- ❌ Cannot query/filter by subscription fields efficiently
- ❌ No type safety or validation
- ❌ More complex frontend code

### Option 2: Separate Subscription Table (Over-engineered)
- ❌ Adds complexity with JOIN queries
- ❌ Not needed for current requirements
- ❌ Harder to maintain referential integrity

### Option 3: Current Approach - Extend Products Table (Recommended)
- ✅ Simple and efficient queries
- ✅ Type-safe with proper column types
- ✅ Easy to validate and maintain
- ✅ Natural extension of product model

---

## Rollback Plan

If issues arise after deployment:

```sql
-- Rollback products table changes
ALTER TABLE products
DROP COLUMN IF EXISTS is_subscription,
DROP COLUMN IF EXISTS subscription_frequency,
DROP COLUMN IF EXISTS included_units,
DROP COLUMN IF EXISTS unit_type,
DROP COLUMN IF EXISTS overage_rate,
DROP COLUMN IF EXISTS is_one_time,
DROP COLUMN IF EXISTS metadata;

-- Rollback products_products table changes
ALTER TABLE products_products
DROP COLUMN IF EXISTS exclusive_group;
```

**Frontend Rollback:**
- Revert commits that added subscription UI fields
- Frontend will function normally with basic product features

---

## Security Considerations

- ✅ No new authentication/authorization changes required
- ✅ Subscription fields follow same access control as other product fields
- ✅ JSONB metadata field should be sanitized if storing user input
- ✅ Overage rate calculations should be server-side validated

---

## Questions for Backend Team

1. **Indexing:** Should we add indexes on `is_subscription` or `subscription_frequency` for filtering?
2. **Constraints:** Should `subscription_frequency` be an ENUM type with validation?
3. **Triggers:** Do we need update triggers for `updated_at` on the new columns?
4. **Migration:** Preferred migration tool/process for this schema change?
5. **Timeline:** When can this be deployed to dev/staging/production?

---

## Approval Required From

- [ ] Backend Team Lead
- [ ] Database Administrator
- [ ] Product Owner
- [ ] QA Team

---

## Notes

**⚠️ IMPORTANT:** The frontend code has already been implemented assuming these schema changes exist. The application **will not function correctly** until the backend schema is updated.

**Current Status:**
- Frontend code: ✅ Complete and ready
- Database schema: ❌ Not yet applied
- API endpoints: ❓ Need to verify they return new fields

**Next Steps:**
1. Backend team reviews this request
2. Backend team applies schema changes to dev environment
3. Frontend team tests against dev
4. Backend team deploys to staging
5. Full QA testing
6. Production deployment coordination
