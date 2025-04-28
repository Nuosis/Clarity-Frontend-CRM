# Supabase Service

This service provides functionality to interact with Supabase using environment variables to select the correct project and get the URL and access token.

## Overview

The Supabase service is a wrapper around the Supabase JavaScript client that provides:

1. Initialization with environment variables
2. Helper functions for common Supabase operations
3. Error handling and consistent response formats
4. Project identification and configuration utilities

## Environment Variables

The service uses the following environment variables from the Vite configuration:

- `VITE_SUPABASE_URL`: The URL of your Supabase project
- `VITE_SUPABASE_KEY`: The anon/public key for your Supabase project

These variables are defined in `src/config.js` with fallback values for development.

## Usage

### Basic Usage

```javascript
import { getSupabaseClient, query } from '../services/supabaseService';

// Get the Supabase client
const supabase = getSupabaseClient();

// Use the client directly
const { data, error } = await supabase.from('customers').select('*');

// Or use the helper functions
const result = await query('customers', {
  select: '*',
  order: { column: 'created_at', ascending: false },
  limit: 10
});

if (result.success) {
  console.log('Customers:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Authentication

```javascript
import { signInWithEmail, signOut, getSession } from '../services/supabaseService';

// Sign in
const signInResult = await signInWithEmail('user@example.com', 'password');

// Get current session
const sessionResult = await getSession();

// Sign out
const signOutResult = await signOut();
```

### Data Operations

```javascript
import { query, insert, update, remove } from '../services/supabaseService';

// Query data
const customers = await query('customers', {
  select: 'id, name, email',
  filter: { column: 'is_active', operator: 'eq', value: true }
});

// Insert data
const newCustomer = await insert('customers', {
  name: 'New Customer',
  email: 'customer@example.com',
  is_active: true
});

// Update data
const updatedCustomer = await update('customers', 
  { name: 'Updated Name' },
  { id: '123' }
);

// Delete data
const deleteResult = await remove('customers', { id: '123' });
```

### Project Information

```javascript
import { getProjectId, isSupabaseConfigured } from '../services/supabaseService';

// Check if Supabase is configured
if (isSupabaseConfigured()) {
  // Get the project ID
  const projectId = getProjectId();
  console.log('Using Supabase project:', projectId);
}
```

## Custom Clients

You can create custom Supabase clients with different URLs and keys:

```javascript
import { createSupabaseClient } from '../services/supabaseService';

// Create a custom client
const customClient = createSupabaseClient(
  'https://custom-project.supabase.co',
  'custom-api-key'
);

// Use the custom client
const { data, error } = await customClient.from('table').select('*');
```

## Testing

You can test the Supabase service using the provided test script:

```bash
npm run test:supabase
```

This will verify that the service is properly configured and can connect to your Supabase project.