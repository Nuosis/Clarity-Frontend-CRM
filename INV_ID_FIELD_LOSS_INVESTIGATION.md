# Sales Record inv_id Field Loss Investigation

## Symptom
When editing an existing sales record that has an inv_id value, the field is lost during the update process. We know this because:
- Console logs show inv_id present during validation: `inv_id: "2025-08-31_admin"`
- Console logs show inv_id becomes null in subsequent operations: `inv_id: null`
- Database record ends up with inv_id set to null after update

## Steps to Recreate
1. Edit an existing sales record that has an inv_id value
2. Make any change to the record (quantity, unit_price, etc.)
3. Save the record
4. Observe console logs showing inv_id present in validation but null in subsequent operations
5. Check database to confirm inv_id field was set to null

## Attempts to Solve the Problem
1. Examined salesService.js updateSale function - field filtering appears correct
2. Modified useSalesActivity.js saveSale function to preserve returned API data
3. Updated processJsonData function comment for clarity
4. Verified that inv_id is included in allowedFields array
5. Confirmed that null values should be preserved for inv_id field
6. Previous fixes did not resolve the issue - inv_id still becomes null

## Hypotheses

1. **Form Data Transformation** (Most Fundamental) - **CONFIRMED**
   - hypothesis: Form data transformation in useSalesActivity.js strips or nullifies inv_id field
   - null hypothesis: Form data transformation preserves inv_id field correctly
   - **EVIDENCE**: Console logs show that `inv_id` arrives as `null` in the `saveSale` function, even though the original record had `"2025-08-31_admin"`. The issue occurs BEFORE the useSalesActivity layer.

2. **Field Filtering Logic**
   - hypothesis: Field filtering in salesService.js updateSale function excludes inv_id from update payload
   - null hypothesis: Field filtering correctly includes inv_id in update payload

3. **Supabase Service Layer**
   - hypothesis: Supabase service layer (supabaseService.js) modifies or strips inv_id during update operation
   - null hypothesis: Supabase service layer passes inv_id through unchanged

4. **Database Schema Constraints**
   - hypothesis: Database schema or RLS policies prevent inv_id updates or force null values
   - null hypothesis: Database schema allows inv_id updates without modification

5. **API Response Processing**
   - hypothesis: processJsonData function or other response processing modifies inv_id values
   - null hypothesis: Response processing preserves inv_id values correctly

6. **React State Management** (Most Dependent)
   - hypothesis: React state updates or component re-renders cause inv_id to be lost
   - null hypothesis: React state management preserves inv_id throughout component lifecycle