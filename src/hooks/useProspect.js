/**
 * useProspect Hook - Prospect data management
 * Follows project's custom hooks pattern (NOT Redux)
 */

import { useState, useEffect, useCallback } from 'react'
import { useAppStateOperations } from '../context/AppStateContext'
import * as prospectApi from '../api/prospects'
import * as prospectService from '../services/prospectService'

const useProspect = () => {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { setSelectedProspect } = useAppStateOperations()

  // Load all prospects
  const loadProspects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await prospectApi.fetchProspects()
      const processed = prospectService.processProspectData(data)
      setProspects(prospectService.sortProspects(processed))
    } catch (err) {
      console.error('Failed to load prospects:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Select a prospect
  const handleProspectSelect = useCallback(
    (prospect) => {
      setSelectedProspect(prospect)
    },
    [setSelectedProspect]
  )

  // Create a new prospect with optimistic update
  const handleProspectCreate = useCallback(
    async (data) => {
      // Generate temporary ID for optimistic update
      const tempId = `temp-${Date.now()}`
      const optimisticProspect = {
        id: tempId,
        recordId: tempId,
        FirstName: data.FirstName || '',
        LastName: data.LastName || '',
        Name: `${data.FirstName || ''} ${data.LastName || ''}`.trim(),
        Email: data.Email || '',
        Phone: data.Phone || '',
        Industry: data.Industry || '',
        AddressLine1: data.AddressLine1 || '',
        AddressLine2: data.AddressLine2 || '',
        City: data.City || '',
        State: data.State || '',
        PostalCode: data.PostalCode || '',
        Country: data.Country || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        type: 'PROSPECT',
        _optimistic: true // Flag to identify optimistic updates
      }

      try {
        setError(null)
        
        // Optimistically add to list immediately
        setProspects(prev => prospectService.sortProspects([optimisticProspect, ...prev]))
        
        // Validate and create on server
        const validated = prospectService.validateProspectData(data)
        const newProspect = await prospectApi.createProspect(validated)
        
        // Replace optimistic prospect with real one
        setProspects(prev => {
          const withoutOptimistic = prev.filter(p => p.id !== tempId)
          const processed = prospectService.processProspectData([newProspect])
          return prospectService.sortProspects([...processed, ...withoutOptimistic])
        })
        
        return newProspect
      } catch (err) {
        console.error('Failed to create prospect:', err)
        setError(err.message)
        
        // Rollback: Remove optimistic prospect
        setProspects(prev => prev.filter(p => p.id !== tempId))
        
        throw err
      }
    },
    []
  )

  // Update an existing prospect
  const handleProspectUpdate = useCallback(
    async (id, data) => {
      try {
        setLoading(true)
        setError(null)
        const validated = prospectService.validateProspectData(data)
        const updated = await prospectApi.updateProspect(id, validated)
        await loadProspects()
        
        // Update the selected prospect with fresh data
        const processed = prospectService.processProspectData([updated])
        if (processed.length > 0) {
          setSelectedProspect(processed[0])
        }
        
        return updated
      } catch (err) {
        console.error('Failed to update prospect:', err)
        setError(err.message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [loadProspects, setSelectedProspect]
  )

  // Delete a prospect
  const handleProspectDelete = useCallback(
    async (id) => {
      try {
        setLoading(true)
        setError(null)
        await prospectApi.deleteProspect(id)
        await loadProspects()
      } catch (err) {
        console.error('Failed to delete prospect:', err)
        setError(err.message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [loadProspects]
  )

  // Toggle active/inactive status
  const handleProspectStatusToggle = useCallback(
    async (id) => {
      const target = prospects.find((p) => p.id === id)
      if (!target) return
      try {
        await handleProspectUpdate(id, { ...target, isActive: !target.isActive })
      } catch (err) {
        console.error('Failed to toggle prospect status:', err)
      }
    },
    [prospects, handleProspectUpdate]
  )

  // Convert prospect to customer
  const handleProspectConvert = useCallback(
    async (prospectId) => {
      try {
        setLoading(true)
        setError(null)

        console.log('[useProspect] Converting prospect ID:', prospectId)
        console.log('[useProspect] Available prospects:', prospects.map(p => ({ id: p.id, name: p.Name })))

        // Find the prospect in local state
        const prospect = prospects.find((p) => p.id === prospectId)

        // If prospect not found in local state, it might still exist in the database
        // We'll let the API handle the validation and error
        if (prospect) {
          console.log('[useProspect] Found prospect in local state:', prospect.Name)

          // Validate prospect data before conversion
          const validation = prospectService.validateProspectForConversion(prospect)

          // Block conversion if there are validation errors (not warnings)
          if (validation.errors.length > 0) {
            throw new Error(validation.errors.join(', '))
          }
        } else {
          console.log('[useProspect] Prospect not found in local state, proceeding with API call')
        }

        // Perform conversion (API will validate existence)
        const result = await prospectApi.convertProspectToCustomer(prospectId)

        // Process the result
        const processedResult = prospectService.processConversionResult(result)

        // Remove from prospects list (now a customer)
        setProspects(prev => prev.filter(p => p.id !== prospectId))

        // Clear selected prospect if it was the converted one
        setSelectedProspect(null)

        return {
          success: true,
          validation: prospect ? prospectService.validateProspectForConversion(prospect) : null,
          result: processedResult
        }
      } catch (err) {
        console.error('Failed to convert prospect:', err)
        setError(err.message)
        throw err // Throw error for consistent error handling
      } finally {
        setLoading(false)
      }
    },
    [prospects, setSelectedProspect]
  )

  // Load prospects at mount
  useEffect(() => {
    loadProspects()
  }, [loadProspects])

  return {
    prospects,
    loading,
    error,
    loadProspects,
    handleProspectSelect,
    handleProspectCreate,
    handleProspectUpdate,
    handleProspectDelete,
    handleProspectStatusToggle,
    handleProspectConvert,
  }
}

export default useProspect