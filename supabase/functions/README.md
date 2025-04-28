# FileMaker Data API Edge Function

This Supabase Edge Function provides a serverless API gateway to interact with the FileMaker Data API. It handles authentication, token management, and provides endpoints for records, scripts, and container operations.

## Features

- **Token Management**: Automatically handles FileMaker Data API token acquisition and release
- **Record Operations**: Create, read, update, and delete records
- **Script Execution**: Run FileMaker scripts with parameters
- **Container Operations**: Upload and download files from container fields

## Environment Variables

The following environment variables need to be set in your Supabase project:

- `FM_USER`: FileMaker username
- `FM_PASSWORD`: FileMaker password
- `FM_URL`: FileMaker Data API URL (default: https://server.selectjanitorial.com/fmi/data/v1)
- `FM_DATABASE`: FileMaker database name

## API Endpoints

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

## Deployment

To deploy this edge function to your Supabase project:

1. Install the Supabase CLI
2. Link your local project to your Supabase project
3. Deploy the edge function:

```bash
supabase functions deploy filemaker-api
```

4. Set the required environment variables in your Supabase project:

```bash
supabase secrets set FM_USER=your_username
supabase secrets set FM_PASSWORD=your_password
supabase secrets set FM_URL=your_filemaker_url
supabase secrets set FM_DATABASE=your_database_name
```

## Local Development

To run the edge function locally:

```bash
supabase start
supabase functions serve filemaker-api
```

## Usage Examples

### List Records

```javascript
const response = await fetch('https://your-project-ref.supabase.co/functions/v1/filemaker-api/records/YourLayout', {
  headers: {
    'Authorization': `Bearer ${supabaseKey}`
  }
});
const data = await response.json();
```

### Create Record

```javascript
const response = await fetch('https://your-project-ref.supabase.co/functions/v1/filemaker-api/records/YourLayout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseKey}`
  },
  body: JSON.stringify({
    fieldData: {
      field1: 'value1',
      field2: 'value2'
    }
  })
});
const data = await response.json();
```

### Execute Script

```javascript
const response = await fetch('https://your-project-ref.supabase.co/functions/v1/filemaker-api/scripts/YourLayout/YourScript?script.param=yourParam', {
  headers: {
    'Authorization': `Bearer ${supabaseKey}`
  }
});
const data = await response.json();
```

### Upload Container Data

```javascript
const formData = new FormData();
formData.append('file', fileBlob);

const response = await fetch('https://your-project-ref.supabase.co/functions/v1/filemaker-api/containers/YourLayout/123/containerField/1', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`
  },
  body: formData
});
const data = await response.json();