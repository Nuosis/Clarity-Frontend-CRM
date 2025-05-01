import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// FileMaker script details
const FM_LAYOUT = 'dapiRecordDetails';
const FM_SCRIPT = 'qb . refreshToken';
const FM_USER = Deno.env.get('FM_USER') || '';
const FM_PASSWORD = Deno.env.get('FM_PASSWORD') || '';
const FM_URL = Deno.env.get('FM_URL') || 'https://server.selectjanitorial.com/fmi/data/v1';
const FM_DATABASE = Deno.env.get('FM_DATABASE') || '';

/**
 * Get QuickBooks credentials from FileMaker
 * This calls the "qb . refreshToken" script in ClarityData to get the realmID and accessToken
 */
async function getQuickBooksCredentials(authToken: string): Promise<{ realmId: string; accessToken: string }> {
  try {
    // Prepare the script parameters
    const scriptParams = JSON.stringify({
      "auth.fileName": FM_DATABASE,
      "auth.serverAddress": FM_URL,
      "auth.userName": FM_USER,
      "auth.password": FM_PASSWORD,
      "logout": 1
    });
    
    // Call the FileMaker edge function to execute the script
    const response = await fetch(`${SUPABASE_URL}/functions/v1/filemaker-api/scripts/${FM_LAYOUT}/${FM_SCRIPT}?script.param=${encodeURIComponent(scriptParams)}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get QuickBooks credentials: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Extract the scriptResult which contains the credentials
    if (data.response && data.response.scriptResult) {
      try {
        const scriptResult = JSON.parse(data.response.scriptResult);
        
        if (scriptResult.error !== "0") {
          throw new Error(`FileMaker script returned error: ${scriptResult.error}`);
        }
        
        return {
          realmId: scriptResult.relmID,
          accessToken: scriptResult.accessToken
        };
      } catch (parseError) {
        throw new Error(`Failed to parse script result: ${parseError.message}`);
      }
    } else {
      throw new Error('Invalid response from FileMaker script');
    }
  } catch (error) {
    console.error('Error getting QuickBooks credentials:', error);
    throw error;
  }
}

/**
 * Make a request to the QuickBooks API
 */
async function makeQuickBooksRequest(
  endpoint: string, 
  method: string, 
  authToken: string, 
  body?: unknown
): Promise<Response> {
  try {
    // Get QuickBooks credentials from FileMaker
    const { realmId, accessToken } = await getQuickBooksCredentials(authToken);
    
    // Construct the QuickBooks API URL
    const apiUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/${endpoint}`;
    
    // Make the request to QuickBooks API
    const response = await fetch(apiUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    return response;
  } catch (error) {
    console.error('Error making QuickBooks request:', error);
    throw error;
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
  
  // Get the authorization token from the request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid authorization token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const authToken = authHeader.substring(7);
  
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Skip the 'quickbooks-api' part if it's in the path
    const startIndex = pathParts[0] === 'quickbooks-api' ? 1 : 0;
    
    if (pathParts.length <= startIndex) {
      return new Response(JSON.stringify({ 
        error: 'Invalid path',
        endpoints: {
          company: '/quickbooks-api/company',
          customers: '/quickbooks-api/customers',
          invoices: '/quickbooks-api/invoices',
          accounts: '/quickbooks-api/accounts',
          items: '/quickbooks-api/items',
          query: '/quickbooks-api/query'
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const resourceType = pathParts[startIndex];
    let response;
    
    switch (resourceType) {
      case 'company':
        // Get company info
        response = await makeQuickBooksRequest('companyinfo/' + (pathParts[startIndex + 1] || 'companyinfo'), 'GET', authToken);
        break;
        
      case 'customers':
        if (req.method === 'GET') {
          if (pathParts.length > startIndex + 1) {
            // Get specific customer
            response = await makeQuickBooksRequest(`customer/${pathParts[startIndex + 1]}`, 'GET', authToken);
          } else {
            // List customers
            response = await makeQuickBooksRequest('query', 'POST', authToken, {
              "Query": "SELECT * FROM Customer MAXRESULTS 1000"
            });
          }
        } else if (req.method === 'POST') {
          // Create customer
          const customerData = await req.json();
          response = await makeQuickBooksRequest('customer', 'POST', authToken, customerData);
        } else if (req.method === 'POST' && pathParts.length > startIndex + 1) {
          // Update customer
          const customerData = await req.json();
          response = await makeQuickBooksRequest('customer', 'POST', authToken, customerData);
        }
        break;
        
      case 'invoices':
        if (req.method === 'GET') {
          if (pathParts.length > startIndex + 1) {
            // Get specific invoice
            response = await makeQuickBooksRequest(`invoice/${pathParts[startIndex + 1]}`, 'GET', authToken);
          } else {
            // List invoices
            response = await makeQuickBooksRequest('query', 'POST', authToken, {
              "Query": "SELECT * FROM Invoice MAXRESULTS 1000"
            });
          }
        } else if (req.method === 'POST') {
          // Create invoice
          const invoiceData = await req.json();
          response = await makeQuickBooksRequest('invoice', 'POST', authToken, invoiceData);
        } else if (req.method === 'POST' && pathParts.length > startIndex + 1) {
          // Update invoice
          const invoiceData = await req.json();
          response = await makeQuickBooksRequest('invoice', 'POST', authToken, invoiceData);
        }
        break;
        
      case 'accounts':
        if (req.method === 'GET') {
          if (pathParts.length > startIndex + 1) {
            // Get specific account
            response = await makeQuickBooksRequest(`account/${pathParts[startIndex + 1]}`, 'GET', authToken);
          } else {
            // List accounts
            response = await makeQuickBooksRequest('query', 'POST', authToken, {
              "Query": "SELECT * FROM Account MAXRESULTS 1000"
            });
          }
        }
        break;
        
      case 'items':
        if (req.method === 'GET') {
          if (pathParts.length > startIndex + 1) {
            // Get specific item
            response = await makeQuickBooksRequest(`item/${pathParts[startIndex + 1]}`, 'GET', authToken);
          } else {
            // List items
            response = await makeQuickBooksRequest('query', 'POST', authToken, {
              "Query": "SELECT * FROM Item MAXRESULTS 1000"
            });
          }
        }
        break;
        
      case 'query':
        if (req.method === 'POST') {
          // Execute a custom query
          const queryData = await req.json();
          response = await makeQuickBooksRequest('query', 'POST', authToken, queryData);
        } else {
          return new Response(JSON.stringify({ error: 'Method not allowed for query endpoint' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
        
      default:
        return new Response(JSON.stringify({ error: 'Invalid resource type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    // Return the QuickBooks API response
    const responseData = await response.json();
    
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});