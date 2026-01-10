# Projects Migration Workflows

## Project Creation Flow

```mermaid
graph TD
    A[User fills ProjectForm] --> B[useProject.handleProjectCreate]
    B --> C[validateProjectData]
    C --> D{Valid?}
    D -->|No| E[Show validation errors]
    D -->|Yes| F[Generate UUID]
    F --> G[formatProjectForFileMaker]
    G --> H[createProject API call]
    H --> I[FileMaker creates record]
    I --> J[Sync to Supabase projects table]
    J --> K{Fixed Price or Subscription?}
    K -->|Yes| L[processProjectValue]
    L --> M[createSalesFromProjectValue]
    M --> N[Update billable status]
    K -->|No| O[Complete]
    N --> O
    O --> P[Reload projects list]
```

## Objective and Steps Management Flow

```mermaid
graph TD
    A[User creates objective] --> B[handleObjectiveCreate]
    B --> C[createObjective API call]
    C --> D[FileMaker creates objective record]
    D --> E[Reload project details]
    E --> F[Display objective in UI]
    F --> G[User adds steps to objective]
    G --> H[Create step API call]
    H --> I[FileMaker creates step record]
    I --> J[Reload project details]
    J --> K[Display step under objective]
    K --> L{User toggles step completion?}
    L -->|Yes| M[Update step completed flag]
    M --> N[Recalculate project completion %]
```

## Fixed Price Project Value Processing

```mermaid
graph TD
    A[Project created with f_fixedPrice=true] --> B{Has dateStart?}
    B -->|Yes| C{dateStart <= today?}
    C -->|Yes| D[Create sellable entry: 50% of value]
    C -->|No| E[Skip start entry]
    B -->|No| E
    D --> F{Has dateEnd?}
    E --> F
    F -->|Yes| G{dateEnd <= today?}
    G -->|Yes| H[Create sales entry: 50% of value]
    G -->|No| I[Skip end entry]
    F -->|No| I
    H --> J[Set all time records as non-billable]
    I --> J
    J --> K[Complete]
```

## Subscription Sales Generation Flow

```mermaid
graph TD
    A[Project created with f_subscription=true] --> B{Has dateStart?}
    B -->|No| C[Skip sales generation]
    B -->|Yes| D{dateStart <= today?}
    D -->|No| C
    D -->|Yes| E{Has dateEnd?}
    E -->|Yes| F[Calculate months from start to end]
    E -->|No| G[Calculate months from start to today]
    F --> H[For each month]
    G --> H
    H --> I[Create sales entry with full value]
    I --> J{More months?}
    J -->|Yes| H
    J -->|No| K[Complete]
    C --> K
```

## Project Status Change Flow

```mermaid
graph TD
    A[User toggles status] --> B[Get current project]
    B --> C{Current status?}
    C -->|Open| D[Set status = Closed]
    C -->|Closed| E[Set status = Open]
    D --> F[Optimistically update UI]
    E --> F
    F --> G[Call updateProjectStatus API]
    G --> H[FileMaker updates record]
    H --> I{Success?}
    I -->|Yes| J[Update persists in UI]
    I -->|No| K[Revert optimistic update]
    K --> L[Show error message]
```

## Related Data Loading Flow

```mermaid
graph TD
    A[User selects project] --> B[handleProjectSelect]
    B --> C{Already loaded?}
    C -->|Yes| D[Display cached data]
    C -->|No| E[loadProjectDetails]
    E --> F[Fetch images in parallel]
    E --> G[Fetch links in parallel]
    E --> H[Fetch objectives in parallel]
    E --> I[Fetch steps in parallel]
    E --> J[Fetch notes in parallel]
    F --> K[Process and merge data]
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L[Update project state]
    L --> M[Display project with all related data]
```

## Team Assignment Flow

```mermaid
graph TD
    A[User changes team in dropdown] --> B[handleProjectTeamChange]
    B --> C[Find project by recordId]
    C --> D{Project found?}
    D -->|No| E[Show error]
    D -->|Yes| F[updateProject API call]
    F --> G[FileMaker updates _teamID]
    G --> H[Update local state]
    H --> I[Update selected project]
    I --> J[UI reflects new team]
```

## Project Deletion Flow

```mermaid
graph TD
    A[User clicks delete icon] --> B[Show confirmation dialog]
    B --> C{User confirms?}
    C -->|No| D[Close dialog]
    C -->|Yes| E[handleProjectDelete]
    E --> F[Find project by id]
    F --> G{Project found?}
    G -->|No| H[Show error]
    G -->|Yes| I[deleteProject API call with recordId]
    I --> J[FileMaker deletes record]
    J --> K[Remove from local projects array]
    K --> L{Was selected project?}
    L -->|Yes| M[Clear selectedProject]
    L -->|No| N[Complete]
    M --> N
    N --> O[Navigate back to customer]
```

## Data Synchronization Pattern (Current)

```mermaid
graph TD
    A[Create/Update in FileMaker] --> B[FileMaker operation succeeds]
    B --> C[Sync to Supabase projects table]
    C --> D{Sync success?}
    D -->|Yes| E[Both systems in sync]
    D -->|No| F[Log error, show warning]
    F --> G[FileMaker remains source of truth]
    E --> H[Continue with operation]
    G --> H
```

## Target Migration Pattern (Future)

```mermaid
graph TD
    A[User action] --> B[Call backend API]
    B --> C[Backend validates request]
    C --> D[Write to Supabase]
    D --> E{Success?}
    E -->|Yes| F[Return updated data]
    E -->|No| G[Return error]
    F --> H[Update frontend state]
    G --> I[Show error to user]
```
