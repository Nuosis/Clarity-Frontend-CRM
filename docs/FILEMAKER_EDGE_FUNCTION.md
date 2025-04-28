# FileMaker Data API Edge Function

This document provides information on how to use the FileMaker Data API edge function in the Clarity CRM Frontend project.

## Overview

The FileMaker Data API edge function is a Supabase edge function that provides a serverless API gateway to interact with the FileMaker Data API. It handles authentication, token management, and provides endpoints for records, scripts, and container operations.

## Features

- **Token Management**: Automatically handles FileMaker Data API token acquisition and release
- **Record Operations**: Create, read, update, and delete records
- **Script Execution**: Run FileMaker scripts with parameters
- **Container Operations**: Upload and download files from container fields

## Setup

### Environment Variables

The following environment variables need to be set in your `.env` file:

```
# FileMaker Data API Configuration (for edge function)
FM_USER=your_username
FM_PASSWORD=your_password
FM_URL=https://server.selectjanitorial.com/fmi/data/v1
FM_DATABASE=your_database

# Supabase configuration (for client-side)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_key
```

Note: The `VITE_` prefix is required for environment variables to be exposed to the client-side code in a Vite project.

### Deployment

To deploy the edge function to your Supabase project:

1. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. Deploy the edge function:
   ```bash
   npm run deploy:edge-function
   ```

This script will:
- Deploy the edge function to your Supabase project
- Set the required environment variables in your Supabase project

## Usage

### Frontend API Client

The project includes a frontend API client that makes it easy to interact with the FileMaker Data API edge function. The client is located at `src/api/fileMakerEdgeFunction.js`.

Here's how to use it:

```javascript
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  executeScript,
  uploadContainer,
  downloadContainer
} from '../api/fileMakerEdgeFunction';

// List records from a layout
const records = await listRecords('Customers');

// Get a specific record
const record = await getRecord('Customers', '123');

// Create a new record
const newRecord = await createRecord('Customers', {
  Name: 'John Doe',
  Email: 'john@example.com'
});

// Update a record
await updateRecord('Customers', '123', {
  Name: 'Jane Doe'
});

// Delete a record
await deleteRecord('Customers', '123');

// Execute a script
const scriptResult = await executeScript('Customers', 'MyScript', 'param1');

// Upload a file to a container field
const file = new File(['file content'], 'filename.txt', { type: 'text/plain' });
await uploadContainer('Customers', '123', 'Photo', file);

// Download a file from a container field
const blob = await downloadContainer('Customers', '123', 'Photo');
```

### Example Component

The project includes an example component that demonstrates how to use the FileMaker Data API edge function. The component is located at `src/components/examples/FileMakerExample.jsx`.

To access the example component, click on the "FileMaker API" button in the sidebar.

## API Endpoints

The edge function provides the following endpoints:

### Records

- `GET /filemaker-api/records/{layout}`: List records from a layout
- `GET /filemaker-api/records/{layout}/{recordId}`: Get a specific record
- `POST /filemaker-api/records/{layout}`: Create a new record
- `PATCH /filemaker-api/records/{layout}/{recordId}`: Update a record
- `DELETE /filemaker-api/records/{layout}/{recordId}`: Delete a record

#### Find Records

To perform a find operation, send a GET request to `/filemaker-api/records/{layout}?_find=true` with a JSON body containing the find criteria.

### Scripts

- `GET /filemaker-api/scripts/{layout}/{scriptName}`: Execute a script
- `GET /filemaker-api/scripts/{layout}/{scriptName}?script.param={param}`: Execute a script with parameters

### Containers

- `GET /filemaker-api/containers/{layout}/{recordId}/{fieldName}/{repetition}`: Download container data
- `POST /filemaker-api/containers/{layout}/{recordId}/{fieldName}/{repetition}`: Upload container data

## Testing

The project includes a test script that allows you to test the FileMaker Data API edge function. The script is located at `scripts/test-edge-function.js`.

To run the test script:

```bash
npm run test:edge-function
```

This script provides an interactive menu that allows you to test the various endpoints of the edge function.

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Make sure the FileMaker credentials in your `.env` file are correct.

2. **Connection Errors**: Make sure the FileMaker server is running and accessible.

3. **Permission Errors**: Make sure the FileMaker user has the necessary permissions to perform the requested operations.

### Logs

To view the logs of the edge function:

```bash
supabase functions logs filemaker-api
```

## References

- [FileMaker Data API Documentation](https://server.selectjanitorial.com/fmi/data/apidoc/)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)