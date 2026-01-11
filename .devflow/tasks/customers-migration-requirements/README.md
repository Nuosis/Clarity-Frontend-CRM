# Customers Migration Requirements

## 📋 Overview

This directory contains **comprehensive requirements documentation** for migrating the Customers feature from FileMaker to Supabase. The documentation package has been validated and approved for backend team implementation.

**Status**: ✅ **READY FOR BACKEND SUBMISSION**
**Last Updated**: 2026-01-10
**Total Documentation**: 14,133 lines across 11 documents
**Validation Report**: [VALIDATION_REPORT.md](./VALIDATION_REPORT.md)

---

## 📚 Documentation Package

### Core Requirements Documents

1. **[Migration Plan](./migration-plan.md)** (2,647 lines)
   - Phased migration approach (6 phases, 4-6 weeks)
   - Data backfill strategy with SQL scripts
   - Feature flag cutover strategy
   - Rollback procedures
   - Risk assessment and mitigation
   - **Start here for executive overview**

2. **[API Contracts](./api-contracts.md)** (2,048 lines)
   - 11 backend endpoints fully specified
   - Request/response examples with JSON
   - HMAC-SHA256 authentication flow
   - Validation rules and error codes
   - Design principles (atomic, idempotent, org-scoped)

3. **[Authorization](./authorization.md)** (1,957 lines)
   - Multi-tenancy model (organization isolation)
   - RLS policies for 5 customer tables
   - Role definitions (admin, staff, read_only, external)
   - Permission matrix and JWT claims structure
   - Security testing procedures

4. **[Edge Cases](./edge-cases.md)** (1,999 lines)
   - 17 critical edge cases documented
   - Concurrent updates, partial failures, network issues
   - Detection SQL and mitigation strategies
   - Backend implementation code examples
   - Validation and testing procedures

5. **[Acceptance Criteria](./acceptance-criteria.md)** (1,547 lines)
   - 50+ acceptance criteria across 10 categories
   - Test procedures with code examples
   - Performance benchmarks (<500ms list, <200ms detail)
   - Pass/fail thresholds and failure actions
   - UAT and sign-off requirements

### Supporting Technical Documents

6. **[Data Model Mapping](./data-model-mapping.md)** (953 lines)
   - Field-by-field FileMaker → Supabase mapping
   - 21 FileMaker fields with transformations
   - Schema gaps and change requests
   - Normalization strategy (flat → related tables)

7. **[ID Reconciliation Strategy](./id-reconciliation-strategy.md)** (1,119 lines)
   - Direct UUID mapping (FileMaker `__ID` → Supabase `id`)
   - No lookup table required
   - Foreign key preservation strategy
   - Validation and reconciliation queries

8. **[Dual-Write Analysis](./dual-write-analysis.md)** (869 lines)
   - Current dual-write patterns analyzed
   - Synchronization gaps identified
   - Failure modes and performance impact
   - Recommendations for improvement

9. **[Supabase Schema](./supabase-schema.md)** (707 lines)
   - Complete schema for 5 customer tables
   - Foreign keys, constraints, indexes
   - RLS status and data quality findings
   - Multi-tenancy considerations

### Context Documents

10. **[Vision](./vision.md)** (95 lines)
    - Problem statement and target state
    - Success criteria overview

11. **[Workflows](./workflows.md)** (192 lines)
    - Current vs target user workflows
    - API call transitions

---

## 🎯 Quick Start Guide

### For Backend Team

**Review Order**:
1. Read [Migration Plan](./migration-plan.md) - Executive summary and prerequisites
2. Review [API Contracts](./api-contracts.md) - Endpoint specifications
3. Review [Authorization](./authorization.md) - RLS policies
4. Review [Data Model Mapping](./data-model-mapping.md) - Schema changes
5. Reference [Edge Cases](./edge-cases.md) and [Acceptance Criteria](./acceptance-criteria.md) during implementation

**Implementation Checklist**:
- [ ] Schema changes (add `is_active`, financial JSONB, indexes)
- [ ] RLS policies (5 tables: customers, customer_email, customer_phone, customer_address, customer_organization)
- [ ] API endpoints (11 endpoints: list, get, create, update, delete, search, batch, stats, validate, migration)
- [ ] Data backfill script (FileMaker → Supabase with UUID preservation)
- [ ] Validation queries and testing

**Key Decisions Required**:
- [ ] Approve `organization_id` assignment strategy for existing customers
- [ ] Confirm email/phone uniqueness scope (global vs org-scoped)
- [ ] Approve soft-delete vs hard-delete approach
- [ ] Approve financial data storage (JSONB vs separate table)

### For Frontend Team

**Preparation Work** (before backend ready):
- [ ] Complete dual-write coverage (CREATE, DELETE, STATUS_TOGGLE)
- [ ] Implement retry queue for failed Supabase writes
- [ ] Add feature flag infrastructure (`VITE_USE_SUPABASE_CUSTOMERS`)

**Post-Backend Work**:
- [ ] Refactor to use backend API endpoints (remove direct Supabase calls)
- [ ] Update error handling for new response format
- [ ] Implement optimistic UI with rollback
- [ ] Remove FileMaker dependencies after 100% cutover

### For QA Team

**Test Planning**:
- [ ] Develop test cases from [Acceptance Criteria](./acceptance-criteria.md)
- [ ] Create edge case tests from [Edge Cases](./edge-cases.md)
- [ ] Set up performance testing (list <500ms, detail <200ms)
- [ ] Plan UAT scenarios from [Workflows](./workflows.md)

---

## 📊 Documentation Statistics

| Metric | Count |
|--------|-------|
| **Total Lines** | 14,133 |
| **Documents** | 11 |
| **Code References** | 150+ |
| **Acceptance Criteria** | 50+ |
| **Edge Cases** | 17+ |
| **API Endpoints** | 11 |
| **Database Tables** | 5 |
| **RLS Policies** | 5 |
| **Migration Phases** | 6 |
| **Estimated Timeline** | 4-6 weeks |

---

## ✅ Validation Summary

**Status**: ✅ **APPROVED** (see [VALIDATION_REPORT.md](./VALIDATION_REPORT.md))

**Quality Metrics**:
- ✅ Completeness: All required sections present
- ✅ Consistency: Zero contradictions across documents
- ✅ Actionability: Backend/frontend/QA can implement independently
- ✅ Code References: 150+ references in file:line format
- ✅ Backend Protocol: Fully compliant (no direct DB modifications)
- ✅ Standing Constraints: All satisfied

**Confidence Level**: **HIGH**

---

## 🚀 Migration Strategy Summary

### Key Decisions

1. **ID Mapping**: Direct UUID mapping (FileMaker `__ID` → Supabase `customers.id`)
   - **No lookup table needed**
   - Preserves foreign key references
   - Simplifies implementation

2. **Cutover Method**: Feature flag with gradual rollout
   - Environment variable: `VITE_USE_SUPABASE_CUSTOMERS`
   - Safe rollback capability
   - Phased testing approach

3. **Dual-Write Enhancement**: Complete before migration
   - Current gap: Only UPDATE syncs to Supabase
   - Need: CREATE, DELETE, STATUS_TOGGLE sync
   - Add retry queue for failures

4. **Backend-First Architecture**: All operations through API
   - Transactional consistency
   - Security enforcement at database layer
   - Single source of truth

### Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 1**: Backend Preparation | 1-2 weeks | Backend team availability |
| **Phase 2**: Dual-Write Completion | 1 week | Phase 1 complete |
| **Phase 3**: Data Backfill | 3-5 days | Phases 1-2 complete |
| **Phase 4**: Frontend Refactor | 1 week | Phase 2 complete |
| **Phase 5**: Gradual Rollout | 1-2 weeks | All phases complete |
| **Phase 6**: Cleanup | 1 week | 100% cutover validated |

**Total**: 4-6 weeks

### Risk Assessment

**Overall Risk**: Medium

**Risk Factors**:
- ✅ Low: Dual-write partially implemented
- ✅ Low: UUID mapping is straightforward
- ⚠️ Medium: 15+ dependent features
- ⚠️ Medium: Incomplete dual-write coverage
- ❌ High: No retry mechanism for failures

**Mitigation**: Feature flag enables instant rollback, gradual rollout limits impact

---

## 🔗 Related Documentation

### Project-Level Documentation
- [Project CLAUDE.md](../../CLAUDE.md) - Backend Change Protocol
- [requirements/customers/](../../requirements/customers/) - Original requirements folder

### Related Features
- **Projects**: Depends on customers (foreign key)
- **Tasks**: Indirect dependency via projects
- **Financial Records**: Depends on customers (customer_sales.customer_id)
- **Prospects**: Already Supabase-only (reference implementation)

---

## 📝 Next Steps

1. ✅ Documentation validation complete
2. **Submit to Backend Team**
   - Share this directory with backend team
   - Schedule review meeting
   - Obtain approval for backend change request
3. **Begin Preparation Work**
   - Frontend: Complete dual-write coverage
   - Frontend: Implement retry queue
   - Backend: Review and approve schema changes
4. **Track Implementation**
   - Use migration-plan.md phase checklist
   - Update acceptance-criteria.md as features complete
   - Document any deviations or scope changes

---

## 📞 Contact & Support

**Documentation Owner**: Frontend Team
**Backend Coordination**: Required before implementation
**Questions**: Review [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) or consult migration-plan.md

---

## 📄 Files in This Directory

```
.devflow/tasks/customers-migration-requirements/
├── README.md                          (this file)
├── VALIDATION_REPORT.md               (validation results)
├── acceptance-criteria.md             (50+ test cases)
├── api-contracts.md                   (11 API endpoints)
├── authorization.md                   (RLS policies)
├── data-model-mapping.md              (field mappings)
├── dual-write-analysis.md             (current sync patterns)
├── edge-cases.md                      (17+ edge cases)
├── id-reconciliation-strategy.md      (UUID mapping)
├── migration-plan.md                  (6-phase plan)
├── supabase-schema.md                 (5 table schemas)
├── tasks.json                         (task tracking)
├── vision.md                          (high-level goals)
└── workflows.md                       (user journeys)
```

---

**Last Updated**: 2026-01-10
**Status**: ✅ Ready for Backend Submission
**Validated By**: Claude Code Autonomous Review
