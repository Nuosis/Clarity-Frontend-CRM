# Financial Activity Component Architecture and Design

## Task Description
Design the architecture for the Financial Activity component that will display financial information related to customers and their projects. This includes defining the data model, component structure, and integration points with the existing application.

## Assigned To
Architect

## Dependencies
- Understanding of the current application architecture
- FileMaker database schema knowledge for financial records

## Expected Outcomes
1. A detailed data model for financial records
2. Component structure design that aligns with the project architecture
3. API integration specifications
4. State management approach

## Technical Requirements

### Data Model
Define the structure for financial data:
- Financial record types (billed, unbilled, invoiced)
- Required fields for financial records (amount, date, customer, project)
- Relationships to other entities (customers, projects)

### FileMaker Integration
- Identify required FileMaker layouts for financial data (dapiRecords)
- Define query parameters for fetching financial records
- Specify sorting and filtering capabilities (by month, quarter, year, Bill status)

### Component Structure
- Design the component hierarchy
- Define props and state requirements
- Specify reusability parameters
- Design chart visualization components for financial data

### State Management
- Define how financial data will be managed in the application state
- Specify caching and refresh strategies
- Design the custom hook interface for financial records

## Deliverables
1. Financial data model documentation
2. Component structure diagram
3. API integration specifications
4. State management approach documentation

## Completion

### 1. Financial data model documentation

The financial data model will include the following:

- **Financial Record Types:** Billed, Unbilled, and Invoiced.
- **Required Fields:**
    - `amount`: The financial amount of the record (Number) - Maps to PRC332.Billable_Time_Rounded * PRC332.Hourly_Rate.
    - `date`: The date of the financial activity (Date) - Maps to PRC332.DateStart.
    - `customerId`: The ID of the customer associated with the record (Number) - Maps to customers_Projects::_custID (accessed via PRC332._projectID relationship).
    - `projectId`: The ID of the project associated with the record (Number) - Maps to PRC332._projectID.
    - `description`: A description of the financial activity (String) - Maps to PRC332.Work Performed.
    - `billedStatus`: The Bill status of the record (String, e.g., 'Billed', 'Unbilled') - Derived from PRC332.f_billed (0 = UnBilled, 1 = Billed).
- **Relationships:**
    - Each financial record will be related to a customer and a project.

### 2. Component structure diagram

The component structure will be as follows:

```
FinancialActivity
├── Dropdown (Timeframe selection)
├── Chart (Stacked bar or line chart)
├── CustomerList
│   └── ProjectList
│       └── RecordTable
│           └── EditModal
```

- `FinancialActivity`: The main component that orchestrates the entire financial activity display.
- `Dropdown`: A component to select the timeframe (e.g., This Month (default), Unbilled, Last Month, This Quarter, This Year).
- `Chart`: A component that renders either a stacked bar chart or a line chart based on the selected timeframe.
- `CustomerList`: A component that displays a sortable list of customers with the total amount billed to each customer.
- `ProjectList`: A component that displays a nested list of projects associated with a selected customer, showing the total amount billed for each project.
- `RecordTable`: A component that displays the individual records for a selected project in a table format.
- `EditModal`: A modal component that allows users to modify record details.

### 3. API integration specifications

The API integration will use the `fetchDataFromFileMaker` function from `src/api/fileMaker.js`.

- **Layout:** `Layouts.RECORDS` (dapiRecords).
- **Action:** `READ`.
- **Query Parameters:**
    - For monthly data: `[{"month":"2","year":"2025"}]` - Using PRC332.month and PRC332.year fields
    - For a range of months: `[{"month":"1","year":"2025"},{"month":"2","year":"2025"},{"month":"3","year":"2025"}]`
    - For unbilled records: `[{"f_billed":0}]` - Using PRC332.f_billed field where 0 = Unbilled
- **Response Fields Mapping:**
    - Financial amount: PRC332.Billable_Time_Rounded * PRC332.Hourly_Rate
    - Date: PRC332.DateStart
    - Project ID: PRC332._projectID
    - Customer ID: customers_Projects::_custID
    - Description: PRC332.Work Performed
    - Billed Status: Derived from PRC332.f_billed

### 4. State management approach documentation

State management will be handled using a custom hook called `useFinancialRecords`.

- The hook will manage the following state variables:
    - `selectedTimeframe`: The currently selected timeframe from the dropdown (default: "This Month").
    - `records`: The data fetched from the API, transformed from FileMaker fields to our application model.
    - `selectedMonth`: The month selected on the line chart (if applicable).
    - `selectedCustomer`: The currently selected customer from the list.
    - `selectedProject`: The currently selected project from the list.
    - `isEditModalOpen`: A boolean to control the visibility of the edit modal.
    - `recordToEdit`: The record currently being edited in the modal.
- The hook will provide functions for:
    - Fetching financial records based on the selected timeframe and other parameters.
    - Transforming FileMaker data to application model (mapping PRC332 fields to our data model).
    - Updating the state variables.
    - Opening and closing the edit modal.
    - Saving changes to a record.
- Data transformation will include:
    - Converting PRC332.Billable_Time_Rounded and PRC332.Hourly_Rate to financial amounts.
    - Formatting PRC332.DateStart to a standardized date format (yyyy-mm-dd).
    - Resolving customer information via the PRC332._projectID to customers_Projects::_custID. THis will be included in the response from filemaker as a field "customers_Projects::_custID"
    - Deriving billed status from PRC332.f_billed (0 = Unbilled, 1 = Billed).

### 5. Chart visualization specifications

- **Stacked Bar Chart:**
    - Used for "Unbilled", "This Month", and "Last Month" timeframes.
    - Displays the total amount owed per customer, segmented by project.
    - X-axis: Customers (derived from customers_Projects::_custID)
    - Y-axis: Amount Owed (calculated from PRC332.Billable_Time_Rounded and PRC332.Hourly_Rate)
    - Each bar is segmented by project (using PRC332._projectID).
- **Line Chart:**
    - Used for "This Quarter" and "This Year" timeframes.
    - Displays overall sales trends by month.
    - X-axis: Months (using PRC332.month and PRC332.year)
    - Y-axis: Total Sales (aggregated from PRC332.Billable_Time_Rounded and PRC332.Hourly_Rate)
    - Data points will be aggregated by month using PRC332.month and PRC332.year fields.
    - Click handler to update the `selectedMonth` state and dynamically render the stacked bar chart in a modal.