# Teams Implementation Plan

## 1. Implementation Plan

*   **Data Model:**
    *   `Teams` table (already exists).
    *   `TeamMembers` table (already exists) - many-to-many relationship between Teams and Staff.
    *   `customers_Projects` table - includes a `_teamID` foreign key referencing the `Teams` table. Projects can only belong to one team.
    *   `Staff` table (already exists).
*   **Backend Changes:**
    *   Create new API endpoints in `src/api/index.js` to:
        *   Fetch teams.
        *   Fetch staff members for a team.
        *   Fetch projects for a team.
        *   Remove staff from a team.
        *   Remove project from a team.
        *   Add a new team.
        *   Delete a team.
    *   Create new services in `src/services/index.js` to interact with the new API endpoints.
*   **Frontend Changes:**
    *   **Sidebar:** Modify `src/components/layout/Sidebar.jsx` to:
        *   Add a toggle to switch between "Customer" and "Team" mode (default to "Customer").
        *   Add an icon-based button to add a new team (similar to the customer implementation).
        *   Add a delete team icon (similar to the customer's implementation).
        *   Fetch and display a list of customers or teams based on the selected mode (displaying only the team name).
        *   Allow the user to select a customer or team based on the selected mode.
    *   **Team Details Component:** Modify `src/components/teams/TeamDetails.jsx` to:
        *   Display the details of the selected team.
        *   Display a list of staff members assigned to the team (using a list similar to `CustomerList.jsx`).
            *   Add a "Remove Staff" icon for each staff member.
        *   Display a list of projects assigned to the team (using a card-based layout, similar to how projects are displayed in `CustomerDetails.jsx`).
            *   Add a "Remove Project" icon for each project.
        *   Provide an "Add Staff" icon button that renders a modal card with a staff selector.
        *   Provide an "Add Project" icon button that renders a modal card to select active customers, then select active projects, then add or cancel.
    *   **AppStateContext:** Modify `src/context/AppStateContext.jsx` to:
        *   Add a `useTeam` hook to manage the selected team and its associated data.
        *   Update the global state to include the selected team and the selected sidebar mode ("Customer" or "Team").
    *   **MainContent:** Modify `src/components/MainContent.jsx` to:
        *   Render the `CustomerDetails` component when a customer is selected in "Customer" mode.
        *   Render the `TeamDetails` component when a team is selected in "Team" mode.
        *   When no customer or team is selected, display a default view.
*   **Database Updates:**
    *   Ensure the database schema includes the existing tables and foreign keys.
*   **Testing:**
    *   Write unit tests for the new API endpoints and services.
    *   Test the UI to ensure that the new functionality works as expected.

## 2. Maintaining Project Style and Functionality:

*   **Use existing components:** Reuse existing components and styling from the `customers` and `projects` directories to maintain a consistent look and feel.
*   **Follow the existing data flow:** Use the same data flow pattern as the `customers` and `projects` features to ensure consistency.
*   **Use existing hooks and services:** Reuse existing hooks and services where possible to avoid code duplication.