/**
 * Prospects API - Direct Supabase Integration
 * Uses Supabase client directly with proper authentication
 *
 * Database Schema:
 * - customers table: id, name, first_name, last_name, business_name, type (customertype enum)
 * - customer_email table: id, customer_id, email, is_primary
 * - customer_phone table: id, customer_id, phone, is_primary
 * - customer_address table: id, customer_id, address_line1, address_line2, city, postal_code, country, is_primary
 * - customer_settings table: id, customer_id, type, data
 *
 * IMPORTANT: Prospects are identified by type='PROSPECT' (NOT NULL)
 * The database schema requires a non-null type value.
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../config.js'

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch all prospects (type='PROSPECT')
 */
export const fetchProspects = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      customer_email(*),
      customer_phone(*),
      customer_address(*),
      customer_settings(*)
    `)
    .eq('type', 'PROSPECT')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch prospects: ${error.message}`)
  }

  return data
}

/**
 * Create new prospect with normalized data structure
 * @param {Object} prospectData - Form data from ProspectForm
 * @param {string} prospectData.FirstName - Prospect first name
 * @param {string} prospectData.LastName - Prospect last name
 * @param {string} prospectData.Email - Prospect email
 * @param {string} prospectData.Phone - Prospect phone (optional)
 * @param {string} prospectData.Industry - Prospect industry (optional)
 * @param {string} prospectData.AddressLine1 - Address line 1 (optional)
 * @param {string} prospectData.AddressLine2 - Address line 2 (optional)
 * @param {string} prospectData.City - City (optional)
 * @param {string} prospectData.PostalCode - Postal code (optional)
 * @param {string} prospectData.Country - Country (optional)
 */
export const createProspect = async (prospectData) => {
  // Step 1: Generate UUID client-side and insert into customers table
  const customerId = crypto.randomUUID()
  
  const customerData = {
    id: customerId,
    first_name: prospectData.FirstName,
    last_name: prospectData.LastName,
    name: `${prospectData.FirstName || ''} ${prospectData.LastName || ''}`.trim(),
    type: 'PROSPECT'
  }
  
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert([customerData])
    .select()
    .single()

  if (customerError) {
    throw new Error(`Failed to create prospect: ${customerError.message}`)
  }

  // Step 2: Insert email if provided
  if (prospectData.Email) {
    const { error: emailError } = await supabase
      .from('customer_email')
      .insert([{
        id: crypto.randomUUID(),
        customer_id: customer.id,
        email: prospectData.Email,
        is_primary: true
      }])

    if (emailError) {
      // Rollback: delete the customer record
      await supabase.from('customers').delete().eq('id', customer.id)
      throw new Error(`Failed to add email: ${emailError.message}`)
    }
  }

  // Step 3: Insert phone if provided
  if (prospectData.Phone) {
    const { error: phoneError } = await supabase
      .from('customer_phone')
      .insert([{
        id: crypto.randomUUID(),
        customer_id: customer.id,
        phone: prospectData.Phone,
        is_primary: true
      }])

    if (phoneError) {
      // Rollback: delete the customer record (cascade will handle email)
      await supabase.from('customers').delete().eq('id', customer.id)
      throw new Error(`Failed to add phone: ${phoneError.message}`)
    }
  }

  // Step 4: Insert address if any address field is provided
  if (prospectData.AddressLine1 || prospectData.AddressLine2 || prospectData.City || prospectData.State || prospectData.PostalCode || prospectData.Country) {
    const addressData = {
      id: crypto.randomUUID(),
      customer_id: customer.id,
      state: prospectData.State || ''  // Required field, default to empty string
    }
    
    if (prospectData.AddressLine1) addressData.address_line1 = prospectData.AddressLine1
    if (prospectData.AddressLine2) addressData.address_line2 = prospectData.AddressLine2
    if (prospectData.City) addressData.city = prospectData.City
    if (prospectData.PostalCode) addressData.postal_code = prospectData.PostalCode
    if (prospectData.Country) addressData.country = prospectData.Country
    
    const { error: addressError } = await supabase
      .from('customer_address')
      .insert([addressData])

    if (addressError) {
      // Rollback: delete the customer record (cascade will handle email/phone)
      await supabase.from('customers').delete().eq('id', customer.id)
      throw new Error(`Failed to add address: ${addressError.message}`)
    }
  }

  // Step 5: Insert industry in customer_settings if provided
  if (prospectData.Industry) {
    const { error: settingError } = await supabase
      .from('customer_settings')
      .insert([{
        id: crypto.randomUUID(),
        customer_id: customer.id,
        type: 'industry',
        data: prospectData.Industry
      }])

    if (settingError) {
      // Rollback: delete the customer record (cascade will handle email/phone/address)
      await supabase.from('customers').delete().eq('id', customer.id)
      throw new Error(`Failed to add industry: ${settingError.message}`)
    }
  }

  // Return the complete prospect with all related data
  const { data: completeProspect, error: fetchError } = await supabase
    .from('customers')
    .select(`
      *,
      customer_email(*),
      customer_phone(*),
      customer_address(*),
      customer_settings(*)
    `)
    .eq('id', customer.id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch created prospect: ${fetchError.message}`)
  }

  return completeProspect
}

/**
 * Update prospect with normalized data structure
 * Handles updates to customers table and related tables (email, phone, address, settings)
 */
export const updateProspect = async (id, prospectData) => {
  // Step 1: Extract fields that belong to related tables
  const { Email, Phone, AddressLine1, AddressLine2, City, State, PostalCode, Country, Industry, FirstName, LastName, ...customerFields } = prospectData
  
  // Step 2: Update customers table (only with fields that belong to it)
  // Convert PascalCase to lowercase for database columns
  const dbCustomerFields = {}
  if (FirstName !== undefined) dbCustomerFields.first_name = FirstName
  if (LastName !== undefined) dbCustomerFields.last_name = LastName
  // Combine first and last name for the name field
  if (FirstName || LastName) {
    dbCustomerFields.name = `${FirstName || ''} ${LastName || ''}`.trim()
  }
  
  // Add any other customer fields (already in correct case)
  Object.keys(customerFields).forEach(key => {
    // Convert PascalCase keys to lowercase
    const dbKey = key.charAt(0).toLowerCase() + key.slice(1)
    dbCustomerFields[dbKey] = customerFields[key]
  })
  
  if (Object.keys(dbCustomerFields).length > 0) {
    const { error: customerError } = await supabase
      .from('customers')
      .update(dbCustomerFields)
      .eq('id', id)

    if (customerError) {
      throw new Error(`Failed to update prospect: ${customerError.message}`)
    }
  }

  // Step 3: Update or insert email if provided
  if (Email !== undefined) {
    // Check if email record exists
    const { data: existingEmail } = await supabase
      .from('customer_email')
      .select('id')
      .eq('customer_id', id)
      .eq('is_primary', true)
      .single()

    if (existingEmail) {
      // Update existing email
      const { error: emailError } = await supabase
        .from('customer_email')
        .update({ email: Email })
        .eq('id', existingEmail.id)

      if (emailError) {
        throw new Error(`Failed to update email: ${emailError.message}`)
      }
    } else if (Email) {
      // Insert new email
      const { error: emailError } = await supabase
        .from('customer_email')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: id,
          email: Email,
          is_primary: true
        }])

      if (emailError) {
        throw new Error(`Failed to add email: ${emailError.message}`)
      }
    }
  }

  // Step 4: Update or insert phone if provided
  if (Phone !== undefined) {
    const { data: existingPhone } = await supabase
      .from('customer_phone')
      .select('id')
      .eq('customer_id', id)
      .eq('is_primary', true)
      .single()

    if (existingPhone) {
      // Update existing phone
      const { error: phoneError } = await supabase
        .from('customer_phone')
        .update({ phone: Phone })
        .eq('id', existingPhone.id)

      if (phoneError) {
        throw new Error(`Failed to update phone: ${phoneError.message}`)
      }
    } else if (Phone) {
      // Insert new phone
      const { error: phoneError } = await supabase
        .from('customer_phone')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: id,
          phone: Phone,
          is_primary: true
        }])

      if (phoneError) {
        throw new Error(`Failed to add phone: ${phoneError.message}`)
      }
    }
  }

  // Step 5: Update or insert address if any address field is provided
  if (AddressLine1 !== undefined || AddressLine2 !== undefined || City !== undefined || State !== undefined || PostalCode !== undefined || Country !== undefined) {
    const { data: existingAddress } = await supabase
      .from('customer_address')
      .select('id')
      .eq('customer_id', id)
      .single()
    
    const addressData = {}
    if (AddressLine1 !== undefined) addressData.address_line1 = AddressLine1
    if (AddressLine2 !== undefined) addressData.address_line2 = AddressLine2
    if (City !== undefined) addressData.city = City
    if (State !== undefined) addressData.state = State
    if (PostalCode !== undefined) addressData.postal_code = PostalCode
    if (Country !== undefined) addressData.country = Country

    if (existingAddress) {
      // Update existing address
      const { error: addressError } = await supabase
        .from('customer_address')
        .update(addressData)
        .eq('id', existingAddress.id)

      if (addressError) {
        throw new Error(`Failed to update address: ${addressError.message}`)
      }
    } else if (Object.keys(addressData).length > 0) {
      // Insert new address - state is required
      const { error: addressError } = await supabase
        .from('customer_address')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: id,
          state: State || '',  // Required field, default to empty string
          ...addressData
        }])

      if (addressError) {
        throw new Error(`Failed to add address: ${addressError.message}`)
      }
    }
  }

  // Step 6: Update or insert industry in customer_settings if provided
  if (Industry !== undefined) {
    const { data: existingSetting } = await supabase
      .from('customer_settings')
      .select('id')
      .eq('customer_id', id)
      .eq('type', 'industry')
      .single()

    if (existingSetting) {
      // Update existing industry setting
      const { error: settingError } = await supabase
        .from('customer_settings')
        .update({ data: Industry })
        .eq('id', existingSetting.id)

      if (settingError) {
        throw new Error(`Failed to update industry: ${settingError.message}`)
      }
    } else if (Industry) {
      // Insert new industry setting
      const { error: settingError } = await supabase
        .from('customer_settings')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: id,
          type: 'industry',
          data: Industry
        }])

      if (settingError) {
        throw new Error(`Failed to add industry: ${settingError.message}`)
      }
    }
  }

  // Step 7: Fetch and return the complete updated prospect
  const { data: updatedProspect, error: fetchError } = await supabase
    .from('customers')
    .select(`
      *,
      customer_email(*),
      customer_phone(*),
      customer_address(*),
      customer_settings(*)
    `)
    .eq('id', id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch updated prospect: ${fetchError.message}`)
  }

  return updatedProspect
}

/**
 * Delete prospect
 */
export const deleteProspect = async (id) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete prospect: ${error.message}`)
  }

  return { success: true }
}