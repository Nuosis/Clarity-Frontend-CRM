# Teams - Migration Plan

## Overview

This document outlines the strategy for migrating the Teams feature from FileMaker to Supabase, including data migration, cutover approach, rollback procedures, and testing requirements.

## Migration Phases

### Phase 1: Backend Implementation (Backend Team)

**Duration:** 2-3 weeks

**Deliverables:**
- [ ] Supabase schema created (teams, team_members, staff tables)
- [ ] RLS policies implemented and tested
- [ ] API endpoints created (REST or RPC)
- [ ] Database triggers and functions implemented
- [ ] Backend integration tests passing
- [ ] API documentation complete

**Acceptance Criteria:**
- All API endpoints return expected responses
- RLS policies enforce organization isolation
- Cascade deletes work correctly
- Performance meets requirements (< 500ms per query)

### Phase 2: Data Migration (Backend + Data Team)

**Duration:** 1 week

**Deliverables:**
- [ ] Migration scripts created
- [ ] Test migration completed in dev environment
- [ ] Data validation reports generated
- [ ] ID mapping table created (if needed)
- [ ] Image migration to Supabase Storage
- [ ] Organization IDs backfilled

**Acceptance Criteria:**
- 100% of FileMaker records migrated
- No data loss or corruption
- Foreign key integrity verified
- Record counts match FileMaker
- Sample queries return matching data

### Phase 3: Frontend Refactor (Frontend Team)

**Duration:** 1-2 weeks

**Deliverables:**
- [ ] FileMaker API calls replaced with Supabase
- [ ] API layer refactored (src/api/teams.js)
- [ ] Service layer updated (src/services/teamService.js)
- [ ] Hook updated (src/hooks/useTeam.js)
- [ ] Components tested with new backend
- [ ] Error handling updated
- [ ] Loading states verified

**Acceptance Criteria:**
- All team operations work with Supabase
- No FileMaker dependencies remain
- UI/UX unchanged from user perspective
- Error messages appropriate
- Performance equal or better than FileMaker

### Phase 4: Testing & Validation (QA + All Teams)

**Duration:** 1 week

**Deliverables:**
- [ ] Manual testing completed
- [ ] Automated tests created and passing
- [ ] Performance testing completed
- [ ] Security testing completed
- [ ] User acceptance testing completed
- [ ] Bug fixes deployed

**Acceptance Criteria:**
- All acceptance criteria met (see acceptance-criteria.md)
- No critical bugs
- Performance within acceptable range
- Users report satisfactory experience

### Phase 5: Deployment & Rollout (DevOps + All Teams)

**Duration:** 1-2 days

**Deliverables:**
- [ ] Production database schema deployed
- [ ] Production data migrated
- [ ] Frontend deployed to production
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Rollback plan ready

**Acceptance Criteria:**
- Zero downtime deployment
- All users can access teams feature
- No data loss
- Monitoring shows healthy metrics
- Rollback plan tested

### Phase 6: Cleanup & Optimization (All Teams)

**Duration:** 1 week

**Deliverables:**
- [ ] FileMaker-specific code removed
- [ ] Dead code eliminated
- [ ] Performance optimizations applied
- [ ] Documentation finalized
- [ ] Training materials updated

**Acceptance Criteria:**
- Codebase clean and maintainable
- Performance meets targets
- Documentation accurate and complete

## Data Migration Strategy

### Migration Script Overview

**Language:** Python or Node.js
**Tools:** Supabase JS client, FileMaker Data API client
**Approach:** Extract, Transform, Load (ETL)

### Migration Steps

**Step 1: Extract FileMaker Data**

```javascript
// Extract all teams
const teams = await fileMaker.fetchRecords({
  layout: 'devTeams',
  query: [{ __ID: '*' }]
});

// Extract all staff
const staff = await fileMaker.fetchRecords({
  layout: 'devStaff',
  query: [{ __ID: '*' }]
});

// Extract all team members
const teamMembers = await fileMaker.fetchRecords({
  layout: 'devTeamMembers',
  query: [{ __ID: '*' }]
});

// Save to intermediate JSON files for validation
fs.writeFileSync('teams.json', JSON.stringify(teams, null, 2));
fs.writeFileSync('staff.json', JSON.stringify(staff, null, 2));
fs.writeFileSync('team-members.json', JSON.stringify(teamMembers, null, 2));
```

**Step 2: Transform Data**

```javascript
// Transform teams
const transformedTeams = teams.map(team => ({
  id: team.fieldData.__ID,  // Preserve UUID if valid
  organization_id: DEFAULT_ORG_ID,  // From environment
  name: team.fieldData.name,
  created_at: convertTimestamp(team.fieldData['~CreationTimestamp']),
  updated_at: convertTimestamp(team.fieldData['~ModificationTimestamp'])
}));

// Transform staff (with image migration)
const transformedStaff = await Promise.all(staff.map(async s => {
  let profileImageUrl = null;

  // Upload image to Supabase Storage if present
  if (s.fieldData.image_base64) {
    profileImageUrl = await uploadImage(
      s.fieldData.image_base64,
      `staff-${s.fieldData.__ID}`
    );
  }

  return {
    id: s.fieldData.__ID,
    organization_id: DEFAULT_ORG_ID,
    name: s.fieldData.name,
    title: s.fieldData.role || null,
    email: null,  // Not in FileMaker
    phone: null,  // Not in FileMaker
    profile_image_url: profileImageUrl,
    is_active: true,
    created_at: convertTimestamp(s.fieldData['~CreationTimestamp']),
    updated_at: convertTimestamp(s.fieldData['~ModificationTimestamp'])
  };
}));

// Transform team members
const transformedTeamMembers = teamMembers.map(tm => ({
  id: tm.fieldData.__ID,
  organization_id: DEFAULT_ORG_ID,
  team_id: tm.fieldData._teamID,
  staff_id: tm.fieldData._staffID,
  role: tm.fieldData.role || null,
  created_at: convertTimestamp(tm.fieldData['~CreationTimestamp']),
  updated_at: convertTimestamp(tm.fieldData['~ModificationTimestamp'])
}));
```

**Step 3: Validate Transformed Data**

```javascript
// Validate UUIDs
transformedTeams.forEach(team => {
  if (!isValidUUID(team.id)) {
    console.error(`Invalid team ID: ${team.id}`);
  }
});

// Validate foreign keys
transformedTeamMembers.forEach(tm => {
  const teamExists = transformedTeams.some(t => t.id === tm.team_id);
  const staffExists = transformedStaff.some(s => s.id === tm.staff_id);

  if (!teamExists) {
    console.error(`Team member ${tm.id} references non-existent team ${tm.team_id}`);
  }
  if (!staffExists) {
    console.error(`Team member ${tm.id} references non-existent staff ${tm.staff_id}`);
  }
});

// Check for duplicates
const teamNames = transformedTeams.map(t => t.name);
const duplicates = teamNames.filter((name, index) => teamNames.indexOf(name) !== index);
if (duplicates.length > 0) {
  console.warn(`Duplicate team names found: ${duplicates.join(', ')}`);
}
```

**Step 4: Load into Supabase**

```javascript
// Use service role to bypass RLS during migration
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Batch insert teams
const { error: teamsError } = await supabase
  .from('teams')
  .insert(transformedTeams);

if (teamsError) {
  console.error('Failed to insert teams:', teamsError);
  throw teamsError;
}

// Batch insert staff
const { error: staffError } = await supabase
  .from('staff')
  .insert(transformedStaff);

if (staffError) {
  console.error('Failed to insert staff:', staffError);
  throw staffError;
}

// Batch insert team members
const { error: membersError } = await supabase
  .from('team_members')
  .insert(transformedTeamMembers);

if (membersError) {
  console.error('Failed to insert team members:', membersError);
  throw membersError;
}

console.log('Migration completed successfully!');
```

**Step 5: Post-Migration Validation**

```javascript
// Count records
const { count: teamCount } = await supabase
  .from('teams')
  .select('*', { count: 'exact', head: true });

const { count: staffCount } = await supabase
  .from('staff')
  .select('*', { count: 'exact', head: true });

const { count: memberCount } = await supabase
  .from('team_members')
  .select('*', { count: 'exact', head: true });

console.log(`Migrated ${teamCount} teams`);
console.log(`Migrated ${staffCount} staff`);
console.log(`Migrated ${memberCount} team members`);

// Verify foreign keys
const { data: orphanedMembers } = await supabase
  .from('team_members')
  .select(`
    id,
    team_id,
    staff_id,
    teams!inner(id),
    staff!inner(id)
  `);

// Should return all members if FKs are valid
if (orphanedMembers.length !== memberCount) {
  console.error('Found orphaned team members!');
}
```

### Image Migration

**Supabase Storage Setup:**
```javascript
// Create storage bucket
const { data: bucket, error } = await supabase
  .storage
  .createBucket('staff-images', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024  // 5MB
  });

// Upload image function
async function uploadImage(base64Data, filename) {
  // Extract base64 content
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return null;
  }

  const mimeType = matches[1];
  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, 'base64');

  // Upload to storage
  const { data, error } = await supabase
    .storage
    .from('staff-images')
    .upload(`${filename}.png`, buffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    console.error(`Failed to upload image for ${filename}:`, error);
    return null;
  }

  // Get public URL
  const { data: publicUrl } = supabase
    .storage
    .from('staff-images')
    .getPublicUrl(`${filename}.png`);

  return publicUrl.publicUrl;
}
```

### Rollback Plan

**If migration fails:**

1. **Stop migration script immediately**
2. **Do NOT deploy frontend changes**
3. **Assess data integrity:**
   - Check which tables were partially migrated
   - Identify any corrupted records

4. **Rollback database:**
   ```sql
   -- Delete all migrated data
   DELETE FROM team_members;
   DELETE FROM teams;
   DELETE FROM staff;

   -- Verify cleanup
   SELECT COUNT(*) FROM teams;      -- Should be 0
   SELECT COUNT(*) FROM staff;      -- Should be 0
   SELECT COUNT(*) FROM team_members;  -- Should be 0
   ```

5. **Fix migration script issues**
6. **Re-test in dev environment**
7. **Re-run migration**

**If frontend deployment fails:**

1. **Revert frontend to previous version**
2. **Users continue using FileMaker backend**
3. **Investigate frontend issues**
4. **Re-deploy when fixed**

**Data stays intact:** Backend migration is separate from frontend deployment.

## Cutover Approach

### Option 1: Big Bang Migration (Recommended)

**Timeline:** Single cutover event

**Steps:**
1. **Friday evening:** Announce maintenance window (2 hours)
2. **Deploy backend:** Database schema + API endpoints
3. **Run migration:** FileMaker → Supabase (30-60 min)
4. **Validate migration:** Run test queries (15 min)
5. **Deploy frontend:** New code using Supabase (15 min)
6. **Smoke test:** Verify basic operations (15 min)
7. **Open to users:** Enable access
8. **Monitor:** Watch logs and metrics

**Pros:**
- Clean cutover
- No dual-write complexity
- Faster completion

**Cons:**
- Requires downtime
- Higher risk if issues found

**Risk Mitigation:**
- Test migration thoroughly in dev/staging
- Have rollback plan ready
- Monitor closely post-deployment

### Option 2: Gradual Rollout (Alternative)

**Timeline:** Phased approach over 1-2 weeks

**Steps:**
1. **Week 1:** Deploy backend, run migration, keep frontend on FileMaker
2. **Week 2 Day 1:** Enable for internal users only
3. **Week 2 Day 3:** Enable for 25% of users
4. **Week 2 Day 5:** Enable for 50% of users
5. **Week 3 Day 1:** Enable for 100% of users

**Pros:**
- Lower risk
- Can catch issues early
- No downtime required

**Cons:**
- More complex feature flagging
- Longer migration period
- Potential data inconsistency

**Implementation:**
```javascript
// Feature flag in frontend
const useSupabaseTeams = () => {
  const user = useUser();

  // Check feature flag
  if (featureFlags.supabaseTeams === 'all') {
    return true;
  }

  if (featureFlags.supabaseTeams === 'internal') {
    return user.isInternal;
  }

  if (featureFlags.supabaseTeams === 'percentage') {
    return user.id % 100 < featureFlags.rolloutPercentage;
  }

  return false;
};
```

## Testing Requirements

### Pre-Migration Testing

**Dev Environment:**
- [ ] Test migration script with sample data
- [ ] Verify record counts match
- [ ] Test all API endpoints
- [ ] Test RLS policies
- [ ] Performance test with realistic data volume

**Staging Environment:**
- [ ] Full migration rehearsal
- [ ] End-to-end frontend testing
- [ ] Load testing
- [ ] Security testing
- [ ] User acceptance testing

### Post-Migration Testing

**Production:**
- [ ] Smoke tests (basic CRUD operations)
- [ ] Sample data validation
- [ ] Performance monitoring
- [ ] Error rate monitoring
- [ ] User feedback collection

### Test Data Sets

**Small Dataset (Dev):**
- 5 teams
- 10 staff
- 15 team memberships
- 20 projects

**Medium Dataset (Staging):**
- 20 teams
- 50 staff
- 100 team memberships
- 100 projects

**Full Dataset (Production):**
- Actual production data
- Estimated: 20-50 teams, 50-100 staff, 100-300 memberships

## Performance Targets

### Query Performance

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| List teams | < 200ms | < 500ms |
| Get team details | < 300ms | < 800ms |
| List staff | < 200ms | < 500ms |
| Assign staff to team | < 400ms | < 1000ms |
| Remove staff from team | < 300ms | < 800ms |
| Get team statistics | < 500ms | < 1500ms |

### Migration Performance

| Operation | Target |
|-----------|--------|
| Total migration time | < 60 minutes |
| Teams migration | < 5 minutes |
| Staff migration | < 10 minutes |
| Team members migration | < 10 minutes |
| Image migration | < 30 minutes |
| Validation | < 5 minutes |

## Monitoring & Alerts

### Metrics to Track

**During Migration:**
- Records processed per minute
- Errors encountered
- Validation failures
- Image upload success rate

**Post-Migration:**
- API response times
- Error rates
- User activity
- Database query performance
- RLS policy violations

### Alerts

**Critical:**
- Migration script crashes
- Database connection lost
- RLS policy failures
- Foreign key violations

**Warning:**
- Slow query performance (> 1s)
- High error rate (> 1%)
- Image upload failures

## Success Criteria

Migration is successful when:
- [ ] 100% of FileMaker records migrated
- [ ] No data loss or corruption
- [ ] All API endpoints functional
- [ ] RLS policies enforced
- [ ] Frontend fully functional
- [ ] Performance meets targets
- [ ] Zero critical bugs
- [ ] User acceptance confirmed

## Timeline

**Total Duration:** 6-8 weeks

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Backend Implementation | 2-3 weeks | None |
| Data Migration | 1 week | Backend complete |
| Frontend Refactor | 1-2 weeks | Backend + Migration complete |
| Testing & Validation | 1 week | All development complete |
| Deployment | 1-2 days | Testing passed |
| Cleanup | 1 week | Deployment stable |

**Critical Path:**
1. Backend schema and API
2. Data migration
3. Frontend refactor
4. Deployment

**Parallel Work:**
- Frontend can start refactor once API contracts defined
- Testing can begin during frontend development

---

**Related Documents:**
- `data-model-mapping.md`: Schema details for migration
- `api-contracts.md`: API endpoints to implement
- `acceptance-criteria.md`: Detailed test cases
- `authorization.md`: RLS policies for backend
- `BACKEND_CHANGE_REQUEST_001_TEAMS_MIGRATION.md`: Backend implementation spec
