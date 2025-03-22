# Create Customer Implementation Plan

## Overview

This document outlines the plan for implementing the functionality to create a new customer in the ClarityFrontend CRM system.

## Requirements

The new customer creation functionality should allow users to create new customers with the following attributes:

*   Name
*   OBSI ClientNo
*   Email
*   phone
*   chargeRate
*   f\_USD (boolean)
*   f\_EUR (boolean)
*   f\_prePay (number)
*   fundsAvailable (number)
*   dbPath
*   dbUserName
*   dbPasword

The `E164number` field should be removed.

The `f_active` field should be set to true by default and not included in the form.

The customer attributes should be grouped in meaningful sections.

The new customer creation functionality should be integrated with the FileMaker backend immediately.

The new customer creation form should be implemented as a modal within the `CustomerList.jsx` component.

## Implementation Plan

1.  **UI Component Creation:**

    *   Create a new component named `CustomerForm.jsx` in the `src/components/customers/` directory.
    *   This component will contain the form for creating a new customer.
    *   The form will include input fields for the following customer attributes, grouped in meaningful sections:

        *   **Basic Information:**
            *   `Name` (required)
            *   `OBSI ClientNo`
        *   **Contact Information:**
            *   `Email`  (required)
            *   `phone`
        *   **Financial Information:**
            *   `chargeRate`  (required)
            *   `f_USD` (boolean) (toogle)
            *   `f_EUR` (boolean) (toogle)
            *   `f_prePay` (number)
            *   `fundsAvailable` (number)
        *   **Database Information:**
            *   `dbPath`
            *   `dbUserName`
            *   `dbPasword`
    *   Remove `E164number`.
    *   Set `f_active` to true by default and do not include it in the form.
    *   Use the `TextInput.jsx` component for text input fields.
    *   For boolean fields (`f_USD`, `f_EUR`), use a toggle switch.
    *   Implement form validation to ensure that all required fields are filled and that the data is in the correct format.
    *   The `__ID` field will be auto-generated using a UUID library (e.g., `uuid`).
    *   The `CustomerForm.jsx` component will be rendered within a modal.

2.  **Integration with FileMaker:**

    *   Modify the `src/api/customers.js` file to include a function for creating a new customer in FileMaker.
    *   This function will take the customer data as input and use the `fm-gofer` library to send the data to the FileMaker backend.
    *   The function will also handle any errors that occur during the FileMaker integration process.

3.  **State Management:**

    *   Use the `AppStateContext.jsx` to manage the state of the customer creation form.
    *   Create a new action in the `AppStateContext.jsx` to create a new customer.
    *   This action will call the `createCustomer` function in `src/api/customers.js` to create the customer in FileMaker.

4.  **UI Integration:**

    *   Integrate the `CustomerForm.jsx` component as a modal within the `CustomerList.jsx` component.
    *   Add a button to the `CustomerList.jsx` component to trigger the modal.

5.  **Error Handling:**

    *   Use the `ErrorBoundary.jsx` component to handle any errors that occur during the customer creation process.
    *   Display an error message to the user if the customer creation fails.

6.  **Testing:**

    *   Write unit tests for the `CustomerForm.jsx` component and the `createCustomer` function in `src/api/customers.js`.
    *   Test the customer creation functionality to ensure that it works correctly.

## Code Structure

```
src/
├── components/
│   ├── customers/
│   │   ├── CustomerDetails.jsx
│   │   ├── CustomerList.jsx  // Modified to include modal trigger
│   │   ├── CustomerForm.jsx  // New component
│   ├── global/
│   │   ├── SnackBar.jsx
│   │   ├── TextInput.jsx
├── api/
│   ├── customers.js  // Modified to include createCustomer function
├── context/
│   ├── AppStateContext.jsx  // Modified to include create customer action
```

## Mermaid Diagram

```mermaid
graph LR
    A[CustomerForm.jsx] --> B(AppStateContext.jsx);
    B --> C(customers.js);
    C --> D[FileMaker];
    E[CustomerList.jsx] --> A;