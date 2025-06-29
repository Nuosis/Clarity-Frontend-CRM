# Supabase Migration Analysis Report

## Executive Summary

Your target Supabase database at `supabase.claritybusinesssolutions.ca` is **accessible and operational** with most of the required schema already in place. The migration is feasible with some missing tables that need to be created.

## Connectivity Status ✅

### Target Database Access
- **Supabase URL**: `https://supabase.claritybusinesssolutions.ca` - ✅ Accessible (401 auth required - expected)
- **API Endpoint**: `https://api.claritybusinesssolutions.ca` - ✅ Accessible 
- **SSH Access**: `dev@app.claritybusinesssolutions.ca` - ✅ Working
- **Database**: PostgreSQL running in Docker container `supabase-db` - ✅ Operational

### Current Infrastructure
The target server is running a complete Supabase stack via Docker:
- `supabase-db` (PostgreSQL 15.8.1.060)
- `supabase-kong` (API Gateway)
- `supabase-rest` (PostgREST API)
- `supabase-auth` (Authentication)
- `supabase-studio` (Admin interface)
- `supabase-storage` (File storage)
- Additional services (realtime, edge functions, etc.)

## Schema Comparison

### ✅ Tables Present in Target Database
The following tables from your expected schema are **already present**:

1. **organizations** - ✅ Compatible structure
   - Has additional `secret` field (not in original schema)
   
2. **customers** - ✅ Compatible structure  
   - Has additional `business_name` and `type` fields
   
3. **customer_email** - ✅ Present
4. **customer_phone** - ✅ Present  
5. **customer_organization** - ✅ Present
6. **customer_user** - ✅ Present
7. **customer_address** - ✅ Present
8. **customer_sales** - ✅ Enhanced structure
   - Has additional fields: `organization_id`, `date`, `inv_id`, `financial_id`
   
9. **user_profile** - ✅ Present
10. **user_preferences** - ✅ Present
11. **licenses** - ✅ Present
12. **license_modules** - ✅ Present
13. **conversations** - ✅ Present (enhanced with `customer_id`)
14. **integration_tokens** - ✅ Present

### ❌ Missing Tables (Need Creation)
The following tables from your expected schema are **missing**:

1. **products** - ❌ Missing
2. **llm_api_keys** - ❌ Missing (may be replaced by different structure)
3. **chat_messages** - ❌ Missing (may be `messages` table instead)
4. **functions** - ❌ Missing

### 🆕 Additional Tables (Not in Original Schema)
The target database has additional tables not in your original schema:

- `agent_memory`
- `blog_posts`, `blog_sections`, `blog_section_images`
- `contact_sync_batches`, `contact_vcard_data`, `contacts`
- `customer_contacts`, `customer_settings`
- `events`, `messages`, `participants`
- `paused_tasks`, `scheduled_tasks`, `task_*` tables
- `alembic_version`

## Migration Requirements

### 1. Missing Tables to Create

```sql
-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price > 0),
  description text,
  organization_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Create llm_api_keys table (if needed)
CREATE TABLE public.llm_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  verified bool DEFAULT false,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create chat_messages table (if not using existing messages table)
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Create functions table
CREATE TABLE public.functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  code text NOT NULL,
  user_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

### 2. Environment Configuration

You'll need to update your environment variables to point to the new database:

```env
# New Supabase Configuration
VITE_SUPABASE_URL=https://supabase.claritybusinesssolutions.ca
VITE_SUPABASE_KEY=[new_anon_key]
VITE_SUPABASE_SERVICE_ROLE_KEY=[new_service_role_key]
```

### 3. API Keys Required

You'll need to obtain from your new Supabase instance:
- Anonymous (public) API key
- Service role (admin) API key

These can typically be found in:
- Supabase Studio at `https://supabase.claritybusinesssolutions.ca:3000`
- Or via the Supabase CLI/configuration files

## Migration Steps

### Phase 1: Schema Preparation
1. Create missing tables in target database
2. Verify all foreign key relationships
3. Set up Row Level Security (RLS) policies if needed

### Phase 2: Configuration Update
1. Obtain API keys from new Supabase instance
2. Update environment variables (requires your permission)
3. Update [`src/config.js`](src/config.js) if needed

### Phase 3: Data Migration (if needed)
1. Export data from current database
2. Import data to new database
3. Verify data integrity

### Phase 4: Testing
1. Test database connectivity
2. Verify all CRUD operations
3. Test authentication flows
4. Validate edge functions

## Recommendations

1. **Create Missing Tables First**: Run the SQL scripts to create missing tables
2. **Test Connectivity**: Create a test script to verify connection with new credentials
3. **Gradual Migration**: Consider a staged approach to minimize downtime
4. **Backup Current Data**: Ensure you have backups before switching
5. **Monitor Performance**: The new database appears to have additional features that might affect performance

## Next Steps

1. Would you like me to create the missing tables in your target database?
2. Do you need help obtaining the API keys from your Supabase instance?
3. Should I prepare a test connection script to verify the new configuration?

## Risk Assessment: LOW ✅

- Target database is operational and accessible
- Most required schema already exists
- Missing tables are straightforward to create
- No major structural incompatibilities detected