# Activity Component Implementation Plan

## 1. Project Setup and Dependencies:

*   Make sure the project has the necessary dependencies: React and a charting library (like Chart.js or Recharts).
*   Check `package.json` to confirm the presence of these libraries.

## 2. Component Structure:

*   Create a new React component called `Activity.jsx` in the `src/components` directory.
*   Define the basic structure of the component with the dropdown, chart area, and customer list area.

## 3. State Management:

*   Use `useState` to manage the following state variables:
    *   `selectedTimeframe`: The currently selected timeframe from the dropdown (default: "This Month").
    *   `records`: The data fetched from the API.
    *   `selectedMonth`: The month selected on the line chart (if applicable).
    *   `selectedCustomer`: The currently selected customer from the list.
    *   `selectedProject`: The currently selected project from the list.
    *   `isEditModalOpen`: A boolean to control the visibility of the edit modal.
    *   `recordToEdit`: The record currently being edited in the modal.

## 4. API Interaction:

*   Create a function called `fetchRecords` that takes the `selectedTimeframe` and any other necessary parameters (e.g., customer ID, project ID) as input.
*   Use `fetchDataFromFileMaker` from `src/api/fileMaker.js` to make a request to the backend API.
    *   `layout`: `Layouts.RECORDS` (which is `dapiRecords`).
    *   `action`: `READ`.
    *   `query`: An array of objects. For monthly data: `[{"month":"2","year":"2025"}]`. For a range of months: `[{"month":"1","year":"2025"},{"month":"2","year":"2025"},{"month":"3","year":"2025"}]`. For unpaid records: `[{"f_billed":0}]`.
*   Handle potential errors during the API request (e.g., using `try...catch`).
*   Update the `records` state with the fetched data.

## 5. Dropdown Implementation:

*   Create a dropdown menu using a `<select>` element.
*   Populate the dropdown with the specified options: "This Month", "Unpaid", "Last Month", "This Quarter", and "This Year".
*   Attach an `onChange` handler to the dropdown that updates the `selectedTimeframe` state.
*   Call `fetchRecords` whenever the `selectedTimeframe` changes.

## 6. Charting Logic:

*   Implement the logic to render either a stacked bar chart or a line chart based on the `selectedTimeframe`.
*   Use a charting library like Chart.js or Recharts to create the charts.
*   For "Unpaid", "This Month", or "Last Month", render a stacked bar chart showing the total amount owed per customer, segmented by project.
*   For "This Quarter" or "This Year", render a line chart showing overall sales trends by month.
*   Implement the click handler for the line chart to update the `selectedMonth` state and dynamically render the stacked bar chart in a modal.

## 7. Customer and Project List:

*   Create a sortable list of customers using a `<table>` or `<ul>` element.
*   Display the total amount billed to each customer.
*   Implement the sorting functionality.
*   Attach an `onClick` handler to each customer row that updates the `selectedCustomer` state.
*   When a customer is selected, render a nested list of projects associated with that customer, showing the total amount billed for each project.
*   Attach an `onClick` handler to each project row that updates the `selectedProject` state.
*   When a project is selected, display the individual records for that project in a table format.

## 8. Edit Modal:

*   Create a modal component that allows users to modify record details.
*   Include an "Edit" button for each record row in the project table.
*   Attach an `onClick` handler to the "Edit" button that opens the modal and sets the `recordToEdit` state.
*   Implement the form elements in the modal to allow users to modify the record details.
*   Implement a "Save" button that updates the record in the `records` state and closes the modal.
*   Implement a "Cancel" button that closes the modal without saving changes.

## 9. Error Handling:

*   Implement error handling for API requests and other potential errors.
*   Display error messages to the user in a user-friendly way (e.g., using a snackbar or alert).

## 10. Performance Optimization:

*   Use memoization techniques (e.g., `React.memo`) to prevent unnecessary re-renders.
*   Implement pagination or virtualization for large datasets.

## 11. Accessibility:

*   Ensure the component is accessible to users with disabilities.
*   Use semantic HTML elements.
*   Provide alternative text for images.
*   Ensure the component is keyboard-navigable.

## 12. Responsive Design:

*   Ensure the component is responsive and adapts to different screen sizes.
*   Use CSS media queries or a responsive CSS framework.