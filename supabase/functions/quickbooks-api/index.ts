import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// FileMaker script details
const FM_LAYOUT = 'dapiRecordDetails';
const FM_SCRIPT = 'qb_refreshToken';
const FM_USER = Deno.env.get('FM_USER') || '';
const FM_PASSWORD = Deno.env.get('FM_PASSWORD') || '';
const FM_URL = Deno.env.get('FM_URL') || 'https://server.selectjanitorial.com/fmi/data/v1';
const FM_DATABASE = Deno.env.get('FM_DATABASE') || '';

/**
 * Get QuickBooks credentials from FileMaker
 * This calls the "qb_refreshToken" script in ClarityData to get the realmID and accessToken
 */
async function getQuickBooksCredentials(authToken: string): Promise<{ realmId: string; accessToken: string }> {
  try {
    // Call the FileMaker edge function to execute the script
    const response = await fetch(`${SUPABASE_URL}/functions/v1/filemaker-api/scripts/${FM_LAYOUT}/${FM_SCRIPT}`, {
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
  // console.log('FileMaker response:', JSON.parse(data.response.scriptError), data.response.scriptResult);
    // Extract the scriptResult which contains the credentials
    try {
      const scriptResult = JSON.parse(data.response.scriptResult);
      const scriptError = data.response.scriptError;
      if (scriptError !== "0") {
        throw new Error(`FileMaker script returned error: ${scriptError}`);
      }
      // console.log('relmID:', scriptResult.relm.ID , "accessToken", scriptResult.access.Token);
      return {
        realmId: scriptResult.relm.ID,
        accessToken: scriptResult.access.Token
      };
    } catch (parseError) {
      throw new Error(`Failed to parse script result: ${parseError.message}`);
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
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<Response> {
  try {
    // Get QuickBooks credentials from FileMaker
    const { realmId, accessToken } = await getQuickBooksCredentials(authToken);
    
    // Construct the QuickBooks API URL
    let apiUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/${endpoint}`;
    
    // Add query parameters for GET requests
    if (method === 'GET' && queryParams) {
      const url = new URL(apiUrl);
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
      // Add minorversion parameter
      url.searchParams.append('minorversion', '70');
      apiUrl = url.toString();
      console.log('GET URL with params:', apiUrl);
    }
    
    // Set up headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    };
    
    let requestBody: string | undefined;
    
    // Handle body for POST requests
    if (method === 'POST') {
      // Special handling for query endpoint - QuickBooks expects text/plain for query
      if (endpoint === 'query' && body && typeof body === 'object' && 'Query' in body) {
        headers['Content-Type'] = 'text/plain';
        // Make sure the query string is properly formatted
        requestBody = (body as { Query: string }).Query.trim();
        console.log('Sending POST query to QuickBooks:', requestBody);
      } else {
        headers['Content-Type'] = 'application/json';
        requestBody = body ? JSON.stringify(body) : undefined;
      }
    }
    
    // Make the request to QuickBooks API
    const response = await fetch(apiUrl, {
      method,
      headers,
      body: method === 'GET' ? undefined : requestBody
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
        response = await makeQuickBooksRequest('companyinfo/' + (pathParts[startIndex + 1] || 'companyinfo'), 'GET', authToken, undefined, undefined);
        break;
        
      case 'customers':
        if (req.method === 'GET') {
          if (pathParts.length > startIndex + 1) {
            const pathParam = pathParts[startIndex + 1];
            
            // Try to parse the path parameter as a number
            const numericId = parseInt(pathParam, 10);
            
            // Check if it's a valid numeric ID (not NaN)
            if (!isNaN(numericId) && numericId.toString() === pathParam) {
              // Get specific customer by ID
              console.log(`Getting customer by ID: ${numericId}`);
              response = await makeQuickBooksRequest(`customer/${numericId}`, 'GET', authToken, undefined, undefined);
            } else {
              // This is a name query - use the query endpoint directly
              const customerName = decodeURIComponent(pathParam);
              console.log(`Querying customer by name: ${customerName}`);
              
              // Escape single quotes in the customer name
              const escapedName = customerName.replace(/'/g, "\\'");
              
              // Construct the query to find customer by DisplayName
              const query = `SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`;
              console.log(`Executing query: ${query}`);
              
              // Use the query endpoint with POST method as shown in the example URL
              // NOTE: AI - DONT FUCK WITH THIS! It is suppose to be a GET not POST
              response = await makeQuickBooksRequest('query', 'GET', authToken, undefined, {
                "query": query
              });
              
              console.log('Customer name query response status:', response.status);
            }
          } else {
            // List customers - only active ones using GET request
            response = await makeQuickBooksRequest('query', 'GET', authToken, undefined, {
              "query": "SELECT * FROM Customer WHERE Active = true"
            });
            // Log the response for debugging
            console.log('QuickBooks API response status:', response.status);
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
            const pathParam = pathParts[startIndex + 1];
            
            // Check if this is a numeric ID or a query
            const numericId = parseInt(pathParam, 10);
            
            if (!isNaN(numericId) && numericId.toString() === pathParam) {
              // Get specific invoice by ID
              response = await makeQuickBooksRequest(`invoice/${pathParam}`, 'GET', authToken, undefined, undefined);
            } else {
              // This is a query - decode and execute it
              const decodedQuery = decodeURIComponent(pathParam);
              console.log(`Executing invoice query: ${decodedQuery}`);
              
              // Use the query endpoint with GET method
              // NOTE: AI - DONT FUCK WITH THIS! It is suppose to be a GET not POST
              response = await makeQuickBooksRequest('query', 'GET', authToken, undefined, {
                "query": decodedQuery
              });
            }
          } else {
            // List invoices - use GET with query parameter
            response = await makeQuickBooksRequest('query', 'GET', authToken, undefined, {
              "query": "SELECT * FROM Invoice MAXRESULTS 1000"
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
            response = await makeQuickBooksRequest(`account/${pathParts[startIndex + 1]}`, 'GET', authToken, undefined, undefined);
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
            response = await makeQuickBooksRequest(`item/${pathParts[startIndex + 1]}`, 'GET', authToken, undefined, undefined);
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
          // Execute a custom query via POST
          const queryData = await req.json();
          console.log('Executing custom POST query:', queryData);
          response = await makeQuickBooksRequest('query', 'POST', authToken, queryData);
          console.log('Custom query response status:', response.status);
        } else if (req.method === 'GET') {
          // Execute a custom query via GET with query parameter
          const queryParam = url.searchParams.get('query');
          if (!queryParam) {
            return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          console.log('Executing custom GET query:', queryParam);
          response = await makeQuickBooksRequest('query', 'GET', authToken, undefined, {
            "query": queryParam
          });
          console.log('Custom GET query response status:', response.status);
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