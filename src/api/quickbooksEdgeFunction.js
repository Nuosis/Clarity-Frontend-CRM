/**
 * @deprecated
 * This Edge Function client is deprecated and intentionally disabled.
 * Do NOT import or use this file. Use src/api/quickbooksApi.js instead.
 * Any usage will throw immediately to prevent calls to /quickbooks-api/*.
 */

throw new Error(
  'Deprecated QuickBooks Edge client (quickbooksEdgeFunction.js) was imported. ' +
  'Migrate to src/api/quickbooksApi.js which targets /quickbooks/* endpoints.'
)

// Intentionally no exports to prevent any usage
export const __deprecatedQuickBooksEdgeClientDisabled = true