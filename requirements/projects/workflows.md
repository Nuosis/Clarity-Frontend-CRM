# Projects - Workflow Diagrams

This document provides visual workflow diagrams showing the key operational flows for the Projects feature, including creation, objective management, business logic processing, and status transitions.

## Overview

The Projects feature involves complex workflows with multiple entities and business rules. These diagrams illustrate:

1. **Project Creation Flow** - End-to-end process from user input to database persistence
2. **Objective & Step Management Flow** - Hierarchical task management workflow
3. **Fixed-Price Project Value Processing** - Sales entry generation for fixed-price projects
4. **Subscription Sales Generation Flow** - Recurring revenue processing for subscriptions
5. **Status Change Flow** - State transitions and business logic triggers

---

## 1. Project Creation Flow

This diagram shows the complete workflow for creating a new project, including validation, dual-write synchronization, and business logic execution.

```mermaid
flowchart TD
    Start([User Initiates Project Creation]) --> Input[User Fills Project Form<br/>- Name, Description<br/>- Customer Selection<br/>- Dates, Budget<br/>- Status]

    Input --> Validate{Frontend Validation}
    Validate -->|Invalid| ShowError[Display Validation Error]
    ShowError --> Input

    Validate -->|Valid| GenUUID[Generate UUID v4 for Project]
    GenUUID --> FormatData[Format Data for FileMaker<br/>- Convert dates MM/DD/YYYY<br/>- Map boolean to 1/0<br/>- Map status values]

    FormatData --> CreateFM[Create Project in FileMaker<br/>Layout: devProjects]
    CreateFM -->|Success| SyncSupabase[Sync to Supabase Projects Table<br/>- Preserve UUID as id<br/>- Convert dates to YYYY-MM-DD<br/>- Map status to lowercase_underscore]

    CreateFM -->|Failure| HandleError[Show Error to User]
    HandleError --> End([End - Project Not Created])

    SyncSupabase -->|Success| CheckPricing{Check Pricing Type}
    SyncSupabase -->|Failure| WarnSync[Warn User: Supabase Sync Failed<br/>Project created in FileMaker only]
    WarnSync --> CheckPricing

    CheckPricing -->|is_fixed_price = true| ProcessFixedPrice[Process Fixed-Price Logic<br/>See Workflow 3]
    CheckPricing -->|is_subscription = true| ProcessSubscription[Process Subscription Logic<br/>See Workflow 4]
    CheckPricing -->|Neither| UpdateBillable[Set Time Records<br/>as Billable]

    ProcessFixedPrice --> UpdateNonBillable[Set Time Records<br/>as Non-Billable]
    ProcessSubscription --> UpdateNonBillable

    UpdateNonBillable --> GenerateSales[Generate Sales Entries<br/>if user has org_id]
    UpdateBillable --> ReloadProjects[Reload Projects List]
    GenerateSales --> ReloadProjects

    ReloadProjects --> Success([End - Project Created Successfully])

    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style End fill:#ffe1e1
    style HandleError fill:#ffe1e1
    style ShowError fill:#ffe1e1
    style WarnSync fill:#fff4e1
    style ProcessFixedPrice fill:#e1f0ff
    style ProcessSubscription fill:#e1f0ff
    style GenerateSales fill:#e1f0ff
```

**Code References**:
- Frontend Hook: `src/hooks/useProject.js:185-305` (`handleProjectCreate`)
- Service Logic: `src/services/projectService.js:213-259` (`validateProjectData`)
- FileMaker API: `src/api/projects.js:112-124` (`createProject`)
- Business Logic: `src/services/projectService.js:508-596` (`processProjectValue`)

**Key Decision Points**:
1. **Validation** - Ensures required fields (name, customer_id) are present
2. **Pricing Type** - Determines whether to generate sales entries
3. **Sync Result** - Warns user if Supabase sync fails but FileMaker succeeds

**Error Handling**:
- Validation errors stop the flow immediately
- FileMaker creation failure prevents Supabase sync
- Supabase sync failure doesn't block completion (degrades gracefully)

---

## 2. Objective & Step Management Flow

This diagram illustrates the hierarchical workflow for managing project objectives and their associated steps, including completion tracking.

```mermaid
flowchart TD
    Start([User Views Project Details]) --> ShowObj[Display Objectives List<br/>Ordered by order_num]

    ShowObj --> UserAction{User Action}

    UserAction -->|Add Objective| CreateObjForm[User Enters Objective Text<br/>Status defaults to Open]
    CreateObjForm --> CalcOrder[Calculate order_num<br/>= max(existing orders) + 1]
    CalcOrder --> CreateObjDB[Create in FileMaker<br/>Layout: devProjectObjectives]
    CreateObjDB --> Delay[Wait 500ms<br/>Avoid race condition]
    Delay --> ReloadObj[Reload Project Details<br/>Fetch updated objectives]
    ReloadObj --> ShowObj

    UserAction -->|Edit Objective| EditObjForm[Edit Objective Text/Status]
    EditObjForm --> UpdateObjDB[Update in FileMaker<br/>Layout: devProjectObjectives]
    UpdateObjDB --> ReloadObj

    UserAction -->|Toggle Completion| ToggleObjFlag{Current Status}
    ToggleObjFlag -->|completed = false| SetObjComplete[Set f_completed = 1<br/>Update timestamp]
    ToggleObjFlag -->|completed = true| SetObjIncomplete[Set f_completed = 0<br/>Update timestamp]
    SetObjComplete --> UpdateObjDB
    SetObjIncomplete --> UpdateObjDB

    UserAction -->|Delete Objective| ConfirmDelObj{Confirm Deletion}
    ConfirmDelObj -->|Cancel| ShowObj
    ConfirmDelObj -->|Confirm| CascadeSteps[Delete ALL Steps<br/>for this objective<br/>CASCADE]
    CascadeSteps --> DeleteObjDB[Delete Objective Record<br/>Layout: devProjectObjectives]
    DeleteObjDB --> ReloadObj

    UserAction -->|Reorder Objectives| DragDrop[User Drags Objective<br/>to New Position]
    DragDrop --> UpdateOrders[Update order_num<br/>for affected objectives]
    UpdateOrders --> BatchUpdate[Batch Update Multiple Records<br/>Layout: devProjectObjectives]
    BatchUpdate --> ReloadObj

    UserAction -->|Expand Objective| ShowSteps[Display Steps List<br/>Ordered by order_num]

    ShowSteps --> StepAction{User Action on Steps}

    StepAction -->|Add Step| CreateStepForm[User Enters Step Text]
    CreateStepForm --> CalcStepOrder[Calculate order_num<br/>= max(existing step orders) + 1]
    CalcStepOrder --> CreateStepDB[Create in FileMaker<br/>Layout: devProjectObjSteps]
    CreateStepDB --> ReloadSteps[Reload Objective Steps<br/>Fetch updated steps]
    ReloadSteps --> ShowSteps

    StepAction -->|Edit Step| EditStepForm[Edit Step Text]
    EditStepForm --> UpdateStepDB[Update in FileMaker<br/>Layout: devProjectObjSteps]
    UpdateStepDB --> ReloadSteps

    StepAction -->|Toggle Completion| ToggleStepFlag{Current Status}
    ToggleStepFlag -->|completed = false| SetStepComplete[Set completed = true<br/>Update timestamp]
    ToggleStepFlag -->|completed = true| SetStepIncomplete[Set completed = false<br/>Update timestamp]
    SetStepComplete --> UpdateStepDB
    SetStepIncomplete --> UpdateStepDB

    StepAction -->|Delete Step| ConfirmDelStep{Confirm Deletion}
    ConfirmDelStep -->|Cancel| ShowSteps
    ConfirmDelStep -->|Confirm| DeleteStepDB[Delete Step Record<br/>Layout: devProjectObjSteps]
    DeleteStepDB --> ReloadSteps

    StepAction -->|Reorder Steps| DragDropStep[User Drags Step<br/>to New Position]
    DragDropStep --> UpdateStepOrders[Update order_num<br/>for affected steps]
    UpdateStepOrders --> BatchUpdateSteps[Batch Update Multiple Records<br/>Layout: devProjectObjSteps]
    BatchUpdateSteps --> ReloadSteps

    StepAction -->|Close Steps| ShowObj
    UserAction -->|Close Project| End([End])

    style Start fill:#e1f5e1
    style End fill:#e1f5e1
    style ConfirmDelObj fill:#fff4e1
    style ConfirmDelStep fill:#fff4e1
    style CascadeSteps fill:#ffe1e1
```

**Code References**:
- Objective Creation: `src/hooks/useProject.js:520-552` (`handleObjectiveCreate`)
- FileMaker Layouts:
  - `devProjectObjectives` (objectives)
  - `devProjectObjSteps` (steps)
- API Calls: `src/api/fileMaker.js:413-415`

**Hierarchical Relationship**:
```
Project (1)
  ├── Objective 1 (order_num: 1)
  │   ├── Step 1.1 (order_num: 1)
  │   ├── Step 1.2 (order_num: 2)
  │   └── Step 1.3 (order_num: 3)
  ├── Objective 2 (order_num: 2)
  │   ├── Step 2.1 (order_num: 1)
  │   └── Step 2.2 (order_num: 2)
  └── Objective 3 (order_num: 3)
```

**Key Features**:
- **Order Management** - `order_num` determines display sequence
- **Cascade Deletes** - Deleting objective removes all its steps
- **Completion Tracking** - Toggle completed flag for objectives and steps
- **Race Condition Handling** - 500ms delay after creation before reload

---

## 3. Fixed-Price Project Value Processing Flow

This diagram shows the business logic for fixed-price projects, including sales entry generation at project start and completion.

```mermaid
flowchart TD
    Start([Project Created/Updated<br/>is_fixed_price = true]) --> ValidateReq{Validate Requirements}

    ValidateReq -->|Missing value| ErrorValue[Error: Fixed-price projects<br/>require value > 0]
    ValidateReq -->|Missing start_date| ErrorStartDate[Error: Fixed-price projects<br/>require start_date]
    ValidateReq -->|is_subscription = true| ErrorMutex[Error: Cannot be both<br/>fixed-price AND subscription]

    ErrorValue --> EndError([End - Validation Failed])
    ErrorStartDate --> EndError
    ErrorMutex --> EndError

    ValidateReq -->|Valid| SetNonBillable[Set ALL Time Records<br/>is_billed = false<br/>for this project_id]

    SetNonBillable --> CheckStartDate{Check start_date}

    CheckStartDate -->|start_date > today| SkipStart[Skip Start Sales Entry<br/>Future start date]
    CheckStartDate -->|start_date <= today| CheckExistingStart{Check Existing<br/>Start Sales Entry}

    CheckExistingStart -->|Exists| SkipStart
    CheckExistingStart -->|Not Exists| CreateStartSale[Create Sales Entry<br/>Type: sellable]

    CreateStartSale --> StartSaleData[Amount: value / 2<br/>Date: start_date<br/>Description: 50% on project start<br/>customer_id: project.customer_id<br/>project_id: project.id<br/>organization_id: from customer]

    StartSaleData --> InsertStartSale[INSERT INTO customer_sales]
    InsertStartSale --> CheckEndDate{Check end_date}
    SkipStart --> CheckEndDate

    CheckEndDate -->|end_date is NULL| SkipEnd[Skip Completion Entry<br/>No end date set]
    CheckEndDate -->|end_date > today| SkipEnd
    CheckEndDate -->|end_date <= today| CheckExistingEnd{Check Existing<br/>Completion Sales Entry}

    CheckExistingEnd -->|Exists| SkipEnd
    CheckExistingEnd -->|Not Exists| CreateEndSale[Create Sales Entry<br/>Type: sales]

    CreateEndSale --> EndSaleData[Amount: value / 2<br/>Date: end_date or actual_end_date<br/>Description: 50% on project completion<br/>customer_id: project.customer_id<br/>project_id: project.id<br/>organization_id: from customer]

    EndSaleData --> InsertEndSale[INSERT INTO customer_sales]

    InsertEndSale --> VerifyTotal{Verify Total}
    SkipEnd --> Success

    VerifyTotal -->|start + end = value| Success([End - Sales Entries Created<br/>Total = project.value])
    VerifyTotal -->|Mismatch| ErrorTotal[Error: Sales entries<br/>don't sum to project value]
    ErrorTotal --> EndError

    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style EndError fill:#ffe1e1
    style ErrorValue fill:#ffe1e1
    style ErrorStartDate fill:#ffe1e1
    style ErrorMutex fill:#ffe1e1
    style ErrorTotal fill:#ffe1e1
    style CreateStartSale fill:#e1f0ff
    style CreateEndSale fill:#e1f0ff
    style SetNonBillable fill:#fff4e1
```

**Code References**:
- Business Logic: `src/services/projectService.js:508-596` (`processProjectValue`)
- Sales Creation: `src/hooks/useProject.js:285-288` (`createSalesFromProjectValue`)
- Time Record Update: `src/services/billableHoursService.js:288-309`

**Sales Entry Examples**:

**Project**: Website Redesign, Value: $10,000, Start: 2024-01-15, End: 2024-06-30

| Type | Amount | Date | Description |
|------|--------|------|-------------|
| sellable | $5,000 | 2024-01-15 | Fixed price project (Website Redesign) - 50% on start |
| sales | $5,000 | 2024-06-30 | Fixed price project (Website Redesign) - 50% on completion |

**Idempotency Strategy**:
```sql
-- Check if sales entry already exists before creating
SELECT id FROM customer_sales
WHERE customer_id = :project.customer_id
  AND date = :project.start_date
  AND product_name LIKE '%50% on project start%'
  AND total_price = :project.value / 2
LIMIT 1;
```

**Edge Cases Handled**:
1. **Future Start Date** - Entry not created until date arrives (requires cron job)
2. **Future End Date** - Entry created when status changes to "Completed" OR date arrives
3. **Duplicate Prevention** - Idempotency check prevents duplicate sales entries
4. **Non-Billable Hours** - All time records marked `is_billed = false`

---

## 4. Subscription Sales Generation Flow

This diagram illustrates the monthly recurring revenue processing for subscription-based projects.

```mermaid
flowchart TD
    Start([Project Created/Updated<br/>is_subscription = true]) --> ValidateReq{Validate Requirements}

    ValidateReq -->|Missing value| ErrorValue[Error: Subscription projects<br/>require value > 0]
    ValidateReq -->|Missing start_date| ErrorStartDate[Error: Subscription projects<br/>require start_date]
    ValidateReq -->|is_fixed_price = true| ErrorMutex[Error: Cannot be both<br/>subscription AND fixed-price]

    ErrorValue --> EndError([End - Validation Failed])
    ErrorStartDate --> EndError
    ErrorMutex --> EndError

    ValidateReq -->|Valid| CheckStartDate{Check start_date}

    CheckStartDate -->|start_date > today| SkipAll[Skip All Entries<br/>Subscription not started yet]
    SkipAll --> EndSkip([End - No Sales Entries<br/>Requires cron job for future])

    CheckStartDate -->|start_date <= today| InitLoop[Initialize Loop<br/>currentDate = start_date<br/>months = 0]

    InitLoop --> LoopCondition{currentDate <= min today, end_date}

    LoopCondition -->|False| LoopEnd[End of Loop<br/>All months processed]
    LoopEnd --> Success([End - Monthly Entries Created])

    LoopCondition -->|True| CalcMonthDate[Calculate Month Date<br/>monthDate = start_date + months]

    CalcMonthDate --> CheckEndDate{end_date set?}
    CheckEndDate -->|Yes| CheckWithinRange{monthDate <= end_date?}
    CheckWithinRange -->|No| LoopEnd
    CheckWithinRange -->|Yes| CheckExisting
    CheckEndDate -->|No| CheckExisting{Check Existing<br/>Sales Entry}

    CheckExisting -->|Exists for this month| IncrementMonth
    CheckExisting -->|Not Exists| CreateMonthlySale[Create Sales Entry<br/>Type: sales]

    CreateMonthlySale --> MonthlySaleData[Amount: value<br/>Date: monthDate<br/>Description: Subscription Month N<br/>customer_id: project.customer_id<br/>project_id: project.id<br/>organization_id: from customer]

    MonthlySaleData --> InsertMonthlySale[INSERT INTO customer_sales]
    InsertMonthlySale --> IncrementMonth[months++<br/>currentDate += 1 month]
    IncrementMonth --> LoopCondition

    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style EndError fill:#ffe1e1
    style EndSkip fill:#fff4e1
    style ErrorValue fill:#ffe1e1
    style ErrorStartDate fill:#ffe1e1
    style ErrorMutex fill:#ffe1e1
    style CreateMonthlySale fill:#e1f0ff
```

**Code References**:
- Business Logic: `src/services/projectService.js:562-593` (`processProjectValue` - subscription section)
- Date Calculation: `src/services/projectService.js:598-608` (`calculateMonthsBetweenDates`)

**Subscription Entry Examples**:

**Project**: Monthly Hosting, Value: $500/month, Start: 2024-01-01, End: 2024-06-30

| Month | Amount | Date | Description |
|-------|--------|------|-------------|
| 1 | $500 | 2024-01-01 | Subscription project (Monthly Hosting) - Month 1 |
| 2 | $500 | 2024-02-01 | Subscription project (Monthly Hosting) - Month 2 |
| 3 | $500 | 2024-03-01 | Subscription project (Monthly Hosting) - Month 3 |
| 4 | $500 | 2024-04-01 | Subscription project (Monthly Hosting) - Month 4 |
| 5 | $500 | 2024-05-01 | Subscription project (Monthly Hosting) - Month 5 |
| 6 | $500 | 2024-06-01 | Subscription project (Monthly Hosting) - Month 6 |

**Monthly Calculation Logic**:
```javascript
// Calculate months between dates
function calculateMonthsBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let months = 0;
    let currentDate = new Date(start);

    while (currentDate <= end) {
        if (currentDate.getDate() === start.getDate()) {
            months++;
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
}
```

**Background Job Requirements**:
- **Frequency**: Monthly cron job (1st of each month)
- **Query**: Find all projects where `is_subscription = true` AND (`end_date IS NULL` OR `end_date >= today`)
- **Action**: Generate new sales entry for current month if not exists
- **Idempotency**: Check for existing entry before creating

**Edge Cases**:
1. **Perpetual Subscription** (no end_date) - Generate entries month-by-month via cron
2. **Mid-Month Start** - First entry on actual start date, subsequent on same day each month
3. **Value Changes** - Future entries use new value, past entries unchanged
4. **Subscription End** - No entries created after end_date

---

## 5. Status Change Flow

This diagram shows the workflow for updating project status and the business logic triggered by specific status transitions.

```mermaid
flowchart TD
    Start([User Changes Project Status]) --> SelectStatus[User Selects New Status<br/>- Open<br/>- Planning<br/>- Active<br/>- On Hold<br/>- Completed<br/>- Cancelled]

    SelectStatus --> ValidateStatus{Valid Status?}
    ValidateStatus -->|Invalid| ErrorStatus[Error: Status must be one of<br/>allowed values]
    ErrorStatus --> End([End - Status Not Changed])

    ValidateStatus -->|Valid| CheckTransition{Status Transition Type}

    CheckTransition -->|→ Completed| IsFixedPrice{is_fixed_price = true?}
    CheckTransition -->|→ Cancelled| HandleCancel[Optional: Handle Cancellation<br/>- Reverse start sales entry?<br/>- Issue refund?<br/>- Manual adjustment?]
    CheckTransition -->|Other| UpdateStatusOnly[Update status field only<br/>No business logic]

    HandleCancel --> UpdateStatus[UPDATE projects<br/>SET status = new_status<br/>updated_at = now]
    UpdateStatusOnly --> UpdateStatus

    IsFixedPrice -->|No| UpdateStatusOnly
    IsFixedPrice -->|Yes| CheckCompletionEntry{Completion Sales<br/>Entry Exists?}

    CheckCompletionEntry -->|Yes| SkipCompletion[Skip - Entry already exists<br/>Idempotency check]
    SkipCompletion --> UpdateStatus

    CheckCompletionEntry -->|No| CreateCompletionSale[Create Sales Entry<br/>Type: sales]

    CreateCompletionSale --> CompletionData[Amount: value / 2<br/>Date: actual_end_date OR today<br/>Description: 50% on project completion<br/>customer_id: project.customer_id<br/>project_id: project.id<br/>organization_id: from customer]

    CompletionData --> InsertCompletion[INSERT INTO customer_sales]
    InsertCompletion --> SetActualEndDate[UPDATE projects<br/>SET actual_end_date = today<br/>if actual_end_date is NULL]
    SetActualEndDate --> UpdateStatus

    UpdateStatus --> SyncSupabase{Environment Type}

    SyncSupabase -->|FileMaker + Web| DualUpdate[Update FileMaker<br/>Layout: devProjects<br/>Field: status]
    DualUpdate --> UpdateSupabaseStatus[Update Supabase<br/>projects.status<br/>Map to lowercase_underscore]

    SyncSupabase -->|Supabase Only| UpdateSupabaseStatus

    UpdateSupabaseStatus -->|Success| NotifyUser[Show Success Message<br/>Status updated]
    UpdateSupabaseStatus -->|Failure| WarnSync[Warn User<br/>FileMaker updated<br/>Supabase sync failed]

    WarnSync --> ReloadProject[Reload Project Details<br/>Refresh UI]
    NotifyUser --> ReloadProject

    ReloadProject --> Success([End - Status Changed Successfully])

    style Start fill:#e1f5e1
    style Success fill:#e1f5e1
    style End fill:#ffe1e1
    style ErrorStatus fill:#ffe1e1
    style WarnSync fill:#fff4e1
    style CreateCompletionSale fill:#e1f0ff
    style HandleCancel fill:#fff4e1
```

**Code References**:
- Status Update: `src/api/projects.js:92-104` (`updateProjectStatus`)
- Hook Handler: `src/hooks/useProject.js:375-415` (`handleProjectStatusChange`)
- Completion Logic: `src/services/projectService.js:543-559` (`processProjectValue` - end date section)

**Status Mapping** (FileMaker → Supabase):
```javascript
const statusMap = {
    'Open': 'active',
    'Active': 'active',
    'Planning': 'pending',
    'Pending': 'pending',
    'On Hold': 'on_hold',
    'Completed': 'completed',
    'Complete': 'completed',
    'Closed': 'completed',
    'Cancelled': 'cancelled'
};
```

**Status Transition Business Rules**:

| From Status | To Status | Business Logic Triggered |
|-------------|-----------|-------------------------|
| Any | Completed | If `is_fixed_price = true`: Create 50% completion sales entry |
| Any | Completed | Set `actual_end_date = today` if NULL |
| Any | Cancelled | Optional: Reverse sales entries or issue refunds |
| Any | On Hold | No special logic |
| On Hold | Active | Resume project - no special logic |
| Active | Completed | Same as any → Completed |

**Completion Sales Entry Trigger**:
```mermaid
graph LR
    A[Status = Completed] --> B{is_fixed_price?}
    B -->|Yes| C[Create 50% Sales Entry]
    B -->|No| D[No Action]
    C --> E[Set actual_end_date]
```

**Edge Cases**:
1. **Multiple Completions** - Idempotency check prevents duplicate sales entries
2. **Incomplete to Completed** - Sales entry created immediately with today's date
3. **Completed to Active** - No reversal logic (manual intervention required)
4. **Cancelled Projects** - Business decision: refund start payment or keep as non-refundable

---

## Workflow Integration Summary

These workflows integrate to form the complete Projects feature:

```mermaid
graph TD
    A[Project Creation Flow] -->|Creates| B[Project Record]
    B -->|Triggers| C[Fixed-Price Flow]
    B -->|Triggers| D[Subscription Flow]
    B -->|Enables| E[Objective Management]
    E -->|Creates| F[Objectives & Steps]
    B -->|Allows| G[Status Change Flow]
    G -->|Triggers| C
    C -->|Creates| H[Sales Entries]
    D -->|Creates| H
    H -->|Syncs to| I[QuickBooks]
    F -->|Tracks| J[Project Completion %]
    G -->|Updates| J
```

**Integration Points**:
1. **Creation → Pricing Logic** - Project creation triggers fixed-price or subscription flows
2. **Status → Completion Logic** - Status change to "Completed" triggers final sales entry
3. **Objectives → Completion Tracking** - Objective/step completion calculates project progress
4. **Sales Entries → Financial Sync** - Generated sales entries sync to QuickBooks
5. **Time Records → Billing** - Fixed-price projects mark time as non-billable

---

## Database Schema Flow

Entity relationships and cascade behaviors:

```mermaid
erDiagram
    PROJECTS ||--o{ PROJECT_OBJECTIVES : contains
    PROJECT_OBJECTIVES ||--o{ PROJECT_OBJECTIVE_STEPS : contains
    PROJECTS ||--o{ PROJECT_IMAGES : has
    PROJECTS ||--o{ LINKS : references
    PROJECTS ||--o{ NOTES : has
    PROJECTS ||--o{ TIME_ENTRIES : tracks
    PROJECTS ||--o{ CUSTOMER_SALES : generates
    PROJECTS }o--|| CUSTOMERS : belongs_to
    PROJECTS }o--o| TEAMS : assigned_to
    PROJECTS }o--|| ORGANIZATIONS : scoped_to

    PROJECTS {
        uuid id PK
        varchar name
        uuid customer_id FK
        uuid team_id FK
        uuid organization_id FK
        varchar status
        decimal budget
        boolean is_fixed_price
        boolean is_subscription
        date start_date
        date target_end_date
        date actual_end_date
    }

    PROJECT_OBJECTIVES {
        uuid id PK
        uuid project_id FK
        text objective
        int order_num
        boolean completed
        varchar status
    }

    PROJECT_OBJECTIVE_STEPS {
        uuid id PK
        uuid objective_id FK
        text step
        int order_num
        boolean completed
    }

    CUSTOMER_SALES {
        uuid id PK
        uuid customer_id FK
        uuid project_id FK
        uuid organization_id FK
        decimal amount
        date date
        varchar type
        text description
    }
```

**Cascade Behaviors**:
- Delete Project → CASCADE deletes objectives, steps, images, links, notes
- Delete Project → SET NULL on time_entries.project_id (preserve time records)
- Delete Objective → CASCADE deletes all steps
- Delete Team → SET NULL on projects.team_id (preserve project)
- Delete Customer → RESTRICT (cannot delete customer with projects)

---

## Performance Considerations

**Query Optimization**:

```sql
-- Efficient: Uses indexes
SELECT * FROM projects WHERE customer_id = 'uuid-123'; -- Uses idx_projects_customer_id
SELECT * FROM projects WHERE status = 'active'; -- Uses idx_projects_status

-- Inefficient: Full table scan
SELECT * FROM projects WHERE name LIKE '%Website%'; -- No index on name

-- Optimized: Include related data in single query
SELECT
    p.*,
    COUNT(DISTINCT o.id) AS objective_count,
    COUNT(DISTINCT s.id) AS step_count,
    SUM(CASE WHEN s.completed = true THEN 1 ELSE 0 END) AS completed_steps
FROM projects p
LEFT JOIN project_objectives o ON o.project_id = p.id
LEFT JOIN project_objective_steps s ON s.objective_id = o.id
WHERE p.customer_id = 'uuid-123'
GROUP BY p.id;
```

**Recommended Indexes**:
```sql
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_project_objectives_project_id ON project_objectives(project_id);
CREATE INDEX idx_project_objective_steps_objective_id ON project_objective_steps(objective_id);
CREATE INDEX idx_customer_sales_project_id ON customer_sales(project_id);
```

---

## Related Documentation

- **current-implementation.md** - Detailed code analysis and FileMaker integration
- **data-model-mapping.md** - Field-by-field mapping between FileMaker and Supabase
- **api-contracts.md** - Complete API endpoint specifications
- **acceptance-criteria.md** - Testing requirements and success metrics
- **migration-plan.md** - Step-by-step migration strategy
- **authorization.md** - Access control and RLS policies

---

## FileMaker Layout References

**Layouts Used in Workflows**:
- `devProjects` - Main projects table (projectService.js, fileMaker.js:413)
- `devProjectObjectives` - Objectives (fileMaker.js:414)
- `devProjectObjSteps` - Objective steps (fileMaker.js:415)
- `devProjectImages` - Project images (fileMaker.js:416)
- `devProjectLinks` - Project links (fileMaker.js:417)
- `devNotes` - Notes (polymorphic, fileMaker.js:418)
- `devRecords` / `dapiRecords` - Time tracking records (fileMaker.js:420)

---

## Migration Workflow Notes

**Dual-Write Pattern** (Current Implementation):
1. Write to FileMaker (source of truth)
2. Sync to Supabase (for web app access)
3. If sync fails, warn user but don't block

**Future Migration** (Supabase-Only):
1. Write to Supabase only
2. FileMaker becomes read-only
3. Eventually deprecate FileMaker layouts

**Key Migration Challenges**:
- Preserve UUIDs during migration (`__ID` → `id`)
- Convert date formats (MM/DD/YYYY → YYYY-MM-DD)
- Convert boolean flags ("1"/"0" → true/false)
- Map status values (various → standardized lowercase_underscore)
- Ensure sales entries are not duplicated during migration
- Maintain relationship integrity (objectives → steps)
