import { serve } from 'http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Environment variables
const FM_USER = Deno.env.get('FM_USER') || '';
const FM_PASSWORD = Deno.env.get('FM_PASSWORD') || '';
const FM_URL = Deno.env.get('FM_URL') || 'https://server.selectjanitorial.com/fmi/data/v1';
const FM_DATABASE = Deno.env.get('FM_DATABASE') || '';

// Token cache
let tokenCache: { token: string; expiry: number } | null = null;

// Helper function to get a token
async function getToken(): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiry > Date.now()) {
    return tokenCache.token;
  }

  // Get a new token
  const response = await fetch(`${FM_URL}/databases/${FM_DATABASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${FM_USER}:${FM_PASSWORD}`)
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get token: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const token = data.response.token;
  
  // Cache the token with a 15-minute expiry (FileMaker default)
  // Subtract 1 minute to be safe
  tokenCache = {
    token,
    expiry: Date.now() + 14 * 60 * 1000
  };

  return token;
}

// Helper function to release a token
async function releaseToken(token: string): Promise<void> {
  try {
    const response = await fetch(`${FM_URL}/databases/${FM_DATABASE}/sessions/${token}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to release token:', await response.text());
    }

    // Clear the token cache if it matches the released token
    if (tokenCache && tokenCache.token === token) {
      tokenCache = null;
    }
  } catch (error) {
    console.error('Error releasing token:', error);
  }
}

// Record endpoints
async function handleRecords(req: Request, layoutName: string, recordId?: string): Promise<Response> {
  try {
    const token = await getToken();
    const url = recordId 
      ? `${FM_URL}/databases/${FM_DATABASE}/layouts/${layoutName}/records/${recordId}` 
      : `${FM_URL}/databases/${FM_DATABASE}/layouts/${layoutName}/records`;
    
    let response;
    
    switch (req.method) {
      case 'GET':
        // Handle query parameters for find/list operations
        const reqUrl = new URL(req.url);
        const params = reqUrl.searchParams;
        
        // Check if this is a find request
        if (params.has('_find')) {
          // This is a find request
          params.delete('_find');
          const findRequest = await req.json();
          response = await fetch(`${FM_URL}/databases/${FM_DATABASE}/layouts/${layoutName}/_find`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(findRequest)
          });
        } else {
          // This is a get/list request
          const queryParams = new URLSearchParams();
          
          // Copy all params except our internal ones
          for (const [key, value] of params.entries()) {
            if (!key.startsWith('_')) {
              queryParams.append(key, value);
            }
          }
          
          const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
          response = await fetch(`${url}${queryString}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }
        break;
        
      case 'POST':
        // Create record
        const createData = await req.json();
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(createData)
        });
        break;
        
      case 'PATCH':
      case 'PUT':
        // Update record
        if (!recordId) {
          return new Response(JSON.stringify({ error: 'Record ID is required for update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const updateData = await req.json();
        response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updateData)
        });
        break;
        
      case 'DELETE':
        // Delete record
        if (!recordId) {
          return new Response(JSON.stringify({ error: 'Record ID is required for delete' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        break;
        
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    const responseData = await response.json();
    
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error handling records:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Script endpoints
async function handleScripts(req: Request, layoutName: string, scriptName: string): Promise<Response> {
  try {
    const token = await getToken();
    const url = `${FM_URL}/databases/${FM_DATABASE}/layouts/${layoutName}/script/${scriptName}`;
    
    // Get script parameters from query string
    const urlObj = new URL(req.url);
    const scriptParam = urlObj.searchParams.get('script.param') || '';
    
    // Construct the URL with the script parameter if provided
    const requestUrl = scriptParam 
      ? `${url}?script.param=${encodeURIComponent(scriptParam)}` 
      : url;
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const responseData = await response.json();
    
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error executing script:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Container endpoints
async function handleContainers(req: Request, layoutName: string, recordId: string, fieldName: string, repetition: string = '1'): Promise<Response> {
  try {
    const token = await getToken();
    const url = `${FM_URL}/databases/${FM_DATABASE}/layouts/${layoutName}/records/${recordId}/containers/${fieldName}/${repetition}`;
    
    if (req.method === 'GET') {
      // Download container data
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Return the binary data with the appropriate content type
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment'
        }
      });
    } else if (req.method === 'POST' || req.method === 'PUT') {
      // Upload container data
      const formData = await req.formData();
      const file = formData.get('file');
      
      if (!file || !(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const uploadFormData = new FormData();
      uploadFormData.append('upload', file);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadFormData
      });
      
      const responseData = await response.json();
      
      return new Response(JSON.stringify(responseData), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error handling container:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Skip the 'filemaker-api' part if it's in the path
    const startIndex = pathParts[0] === 'filemaker-api' ? 1 : 0;
    
    if (pathParts.length <= startIndex) {
      return new Response(JSON.stringify({ 
        error: 'Invalid path',
        endpoints: {
          records: '/filemaker-api/records/{layout}/{recordId?}',
          scripts: '/filemaker-api/scripts/{layout}/{scriptName}',
          containers: '/filemaker-api/containers/{layout}/{recordId}/{fieldName}/{repetition?}'
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const resourceType = pathParts[startIndex];
    
    switch (resourceType) {
      case 'records':
        // Handle record operations
        if (pathParts.length <= startIndex + 1) {
          return new Response(JSON.stringify({ error: 'Layout name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const layoutName = pathParts[startIndex + 1];
        const recordId = pathParts.length > startIndex + 2 ? pathParts[startIndex + 2] : undefined;
        
        return await handleRecords(req, layoutName, recordId);
        
      case 'scripts':
        // Handle script operations
        if (pathParts.length <= startIndex + 2) {
          return new Response(JSON.stringify({ error: 'Layout name and script name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const scriptLayoutName = pathParts[startIndex + 1];
        const scriptName = pathParts[startIndex + 2];
        
        return await handleScripts(req, scriptLayoutName, scriptName);
        
      case 'containers':
        // Handle container operations
        if (pathParts.length <= startIndex + 3) {
          return new Response(JSON.stringify({ error: 'Layout name, record ID, and field name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const containerLayoutName = pathParts[startIndex + 1];
        const containerRecordId = pathParts[startIndex + 2];
        const fieldName = pathParts[startIndex + 3];
        const repetition = pathParts.length > startIndex + 4 ? pathParts[startIndex + 4] : '1';
        
        return await handleContainers(req, containerLayoutName, containerRecordId, fieldName, repetition);
        
      default:
        return new Response(JSON.stringify({ error: 'Invalid resource type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});