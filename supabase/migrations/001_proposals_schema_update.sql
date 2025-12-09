-- ============================================================================
-- Proposal System Schema Updates
-- ============================================================================
-- This migration adds:
-- 1. Projects table (parent of proposals)
-- 2. Updates to proposal_deliverables (add 'subscription' type)
-- 3. Proposal requirements table
-- 4. Proposal packages table
-- 5. Join tables for packages-deliverables and packages-requirements
-- ============================================================================

-- ============================================================================
-- 1. PROJECTS TABLE
-- ============================================================================
-- Projects are the parent entity for proposals
-- A project can have multiple proposals over time

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'on_hold', 'completed', 'cancelled')),

  -- Project details
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget DECIMAL(10,2),

  -- Integration fields
  github_repo_url TEXT,
  project_link TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Indexes
  CONSTRAINT projects_customer_id_key UNIQUE (customer_id, name)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admin can manage projects" ON projects
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 2. UPDATE EXISTING PROPOSALS TABLE
-- ============================================================================
-- Add project_id foreign key if proposals table exists and doesn't have it

DO $$
BEGIN
  -- Add project_id foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'proposals_project_id_fkey'
  ) THEN
    ALTER TABLE proposals
    ADD CONSTRAINT proposals_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE PROPOSAL_DELIVERABLES TYPE ENUM
-- ============================================================================
-- Add 'subscription' as a valid deliverable type

DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE proposal_deliverables
  DROP CONSTRAINT IF EXISTS proposal_deliverables_type_check;

  -- Add the new constraint with 'subscription' type
  ALTER TABLE proposal_deliverables
  ADD CONSTRAINT proposal_deliverables_type_check
  CHECK (type IN ('fixed', 'hourly', 'subscription'));
END $$;

-- Add subscription-specific fields to deliverables
ALTER TABLE proposal_deliverables
ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS subscription_duration_months INTEGER;

-- ============================================================================
-- 4. PROPOSAL REQUIREMENTS TABLE
-- ============================================================================
-- Tracks what the client must provide to developers to satisfy deliverables

CREATE TABLE IF NOT EXISTS proposal_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Requirement details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('content', 'access', 'assets', 'documentation', 'credentials', 'other')),

  -- Status tracking
  is_required BOOLEAN DEFAULT TRUE,
  is_fulfilled BOOLEAN DEFAULT FALSE,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by TEXT,

  -- Priority and ordering
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  order_index INTEGER DEFAULT 0,

  -- Additional metadata
  notes TEXT,
  due_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proposal_requirements_proposal_id ON proposal_requirements(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_requirements_priority ON proposal_requirements(priority);
CREATE INDEX IF NOT EXISTS idx_proposal_requirements_is_fulfilled ON proposal_requirements(is_fulfilled);

-- Add updated_at trigger
CREATE TRIGGER proposal_requirements_updated_at_trigger
  BEFORE UPDATE ON proposal_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Row Level Security
ALTER TABLE proposal_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage proposal requirements" ON proposal_requirements
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. PROPOSAL PACKAGES TABLE
-- ============================================================================
-- Packages are collections of deliverables and requirements bundled together

CREATE TABLE IF NOT EXISTS proposal_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Package details
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  final_price DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Package metadata
  is_featured BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,

  -- Visual styling
  badge_text TEXT, -- e.g., "Most Popular", "Best Value"
  badge_color TEXT, -- hex color code

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proposal_packages_proposal_id ON proposal_packages(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_packages_is_featured ON proposal_packages(is_featured);
CREATE INDEX IF NOT EXISTS idx_proposal_packages_order_index ON proposal_packages(order_index);

-- Add updated_at trigger
CREATE TRIGGER proposal_packages_updated_at_trigger
  BEFORE UPDATE ON proposal_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Row Level Security
ALTER TABLE proposal_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage proposal packages" ON proposal_packages
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 6. PROPOSAL_PACKAGES_DELIVERABLES JOIN TABLE
-- ============================================================================
-- Links packages to their deliverables

CREATE TABLE IF NOT EXISTS proposal_packages_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES proposal_packages(id) ON DELETE CASCADE,
  deliverable_id UUID NOT NULL REFERENCES proposal_deliverables(id) ON DELETE CASCADE,

  -- Optional overrides for this package
  price_override DECIMAL(10,2), -- Override deliverable price for this package
  is_required_in_package BOOLEAN DEFAULT FALSE, -- Must be included in this package

  -- Ordering within package
  order_index INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure uniqueness
  CONSTRAINT proposal_packages_deliverables_unique UNIQUE (package_id, deliverable_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_packages_deliverables_package_id ON proposal_packages_deliverables(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_deliverables_deliverable_id ON proposal_packages_deliverables(deliverable_id);

-- Row Level Security
ALTER TABLE proposal_packages_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage package deliverables" ON proposal_packages_deliverables
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 7. PROPOSAL_PACKAGES_REQUIREMENTS JOIN TABLE
-- ============================================================================
-- Links packages to their requirements

CREATE TABLE IF NOT EXISTS proposal_packages_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES proposal_packages(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES proposal_requirements(id) ON DELETE CASCADE,

  -- Requirement metadata for this package
  is_required_in_package BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure uniqueness
  CONSTRAINT proposal_packages_requirements_unique UNIQUE (package_id, requirement_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_packages_requirements_package_id ON proposal_packages_requirements(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_requirements_requirement_id ON proposal_packages_requirements(requirement_id);

-- Row Level Security
ALTER TABLE proposal_packages_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage package requirements" ON proposal_packages_requirements
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 8. HELPER VIEWS
-- ============================================================================

-- View for complete package information with counts
CREATE OR REPLACE VIEW proposal_packages_summary AS
SELECT
  pp.id,
  pp.proposal_id,
  pp.name,
  pp.description,
  pp.base_price,
  pp.discount_percentage,
  pp.final_price,
  pp.is_featured,
  pp.is_available,
  pp.badge_text,
  pp.badge_color,
  COUNT(DISTINCT ppd.deliverable_id) as deliverable_count,
  COUNT(DISTINCT ppr.requirement_id) as requirement_count,
  pp.created_at
FROM proposal_packages pp
LEFT JOIN proposal_packages_deliverables ppd ON pp.id = ppd.package_id
LEFT JOIN proposal_packages_requirements ppr ON pp.id = ppr.package_id
GROUP BY pp.id;

-- View for proposal overview with all related data counts
CREATE OR REPLACE VIEW proposals_overview AS
SELECT
  p.id,
  p.project_id,
  p.customer_id,
  p.title,
  p.status,
  p.total_price,
  p.selected_price,
  COUNT(DISTINCT pd.id) as deliverable_count,
  COUNT(DISTINCT pr.id) as requirement_count,
  COUNT(DISTINCT pp.id) as package_count,
  COUNT(DISTINCT pc.id) as concept_count,
  p.created_at,
  p.updated_at
FROM proposals p
LEFT JOIN proposal_deliverables pd ON p.id = pd.proposal_id
LEFT JOIN proposal_requirements pr ON p.id = pr.proposal_id
LEFT JOIN proposal_packages pp ON p.id = pp.proposal_id
LEFT JOIN proposal_concepts pc ON p.id = pc.proposal_id
GROUP BY p.id;

-- ============================================================================
-- 9. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE projects IS 'Projects are the parent entity for proposals. A customer can have multiple projects.';
COMMENT ON TABLE proposal_requirements IS 'Requirements that the client must provide to developers to satisfy deliverables.';
COMMENT ON TABLE proposal_packages IS 'Bundled collections of deliverables and requirements offered at a package price.';
COMMENT ON TABLE proposal_packages_deliverables IS 'Join table linking packages to their included deliverables.';
COMMENT ON TABLE proposal_packages_requirements IS 'Join table linking packages to their required client requirements.';

COMMENT ON COLUMN proposal_deliverables.type IS 'Type of deliverable: fixed (one-time cost), hourly (time-based), or subscription (recurring)';
COMMENT ON COLUMN proposal_deliverables.billing_interval IS 'For subscription deliverables: monthly, quarterly, or yearly billing';
COMMENT ON COLUMN proposal_requirements.category IS 'Category of requirement: content, access, assets, documentation, credentials, or other';
COMMENT ON COLUMN proposal_packages.discount_percentage IS 'Percentage discount applied to the sum of deliverable prices in this package';

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions to authenticated users
GRANT ALL ON projects TO authenticated;
GRANT ALL ON proposal_requirements TO authenticated;
GRANT ALL ON proposal_packages TO authenticated;
GRANT ALL ON proposal_packages_deliverables TO authenticated;
GRANT ALL ON proposal_packages_requirements TO authenticated;

-- Grant read access to views
GRANT SELECT ON proposal_packages_summary TO authenticated;
GRANT SELECT ON proposals_overview TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
