import { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useProposalPackages } from '../../hooks/useProposalExtended';

const Container = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: 8px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const Description = styled.p`
  margin: 0 0 24px 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 14px;
  line-height: 1.5;
`;

const PackagesList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
`;

const PackageCard = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border: 2px solid ${props => props.$isFeatured
    ? props.theme.colors.primary
    : props.theme.colors.border};
  border-radius: ${props => props.theme.radius.xl};
  padding: 24px;
  transition: ${props => props.theme.transitions.slow};
  position: relative;
  overflow: hidden;

  ${props => props.$isFeatured && `
    box-shadow: ${props.theme.shadows.lg};
    transform: scale(1.02);
  `}

  &:hover {
    box-shadow: ${props => props.theme.shadows.lg};
    transform: translateY(-2px);
  }
`;

const FeaturedBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  background: ${props => props.theme.colors.primary};
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PackageName = styled.h4`
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
`;

const PackageDescription = styled.p`
  margin: 0 0 16px 0;
  font-size: 13px;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.4;
`;

const PricingSection = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const PriceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PriceLabel = styled.span`
  color: ${props => props.theme.colors.text.secondary};
`;

const PriceValue = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const TotalPrice = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  text-align: center;
  margin: 16px 0;
`;

const DiscountBadge = styled.div`
  text-align: center;
  color: ${props => props.theme.colors.success};
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
`;

const IncludedSection = styled.div`
  margin-top: 16px;
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ItemsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Item = styled.li`
  padding: 4px 0 4px 20px;
  position: relative;
  font-size: 13px;
  color: ${props => props.theme.colors.text.secondary};

  &:before {
    content: '✓';
    position: absolute;
    left: 0;
    color: ${props => props.theme.colors.success};
    font-weight: bold;
  }
`;

const EditButton = styled.button`
  width: 100%;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 12px;

  &:hover {
    background: ${props => props.theme.colors.primaryDark};
    transform: translateY(-1px);
  }
`;

const DeleteButton = styled.button`
  width: 100%;
  background: none;
  color: ${props => props.theme.colors.danger};
  border: 1px solid ${props => props.theme.colors.danger};
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;

  &:hover {
    background: ${props => props.theme.colors.danger};
    color: white;
  }
`;

const CreatePackageButton = styled.button`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: ${props => props.theme.colors.primaryDark};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border-radius: ${props => props.theme.radius.xl};
  padding: 32px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radius.md};
  font-size: 14px;
  margin-bottom: 16px;
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primaryLight};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.tertiary};
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 6px;
`;

const CheckboxGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.background.secondary};
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: ${props => props.theme.colors.primary};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

const SaveButton = styled.button`
  flex: 1;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.primaryDark};
  }
`;

const CancelButton = styled.button`
  flex: 1;
  background: none;
  color: ${props => props.theme.colors.text.secondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.background.secondary};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.text.secondary};
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

/**
 * SummaryTab Component
 * Creates and manages proposal packages with pricing calculations
 * Typically creates 3 packages: MVP, Professional, and Premium
 * Integrated with backend API for package persistence
 *
 * @param {Object} props - Component props
 * @param {string} props.proposalId - Proposal ID for API operations
 * @param {Array} props.packages - Array of package objects (for local-only mode)
 * @param {Array} props.deliverables - Available deliverables
 * @param {Array} props.requirements - Available requirements
 * @param {Function} props.onChange - Callback when packages change (for local-only mode)
 */
const SummaryTab = ({ proposalId, packages: localPackages = [], deliverables = [], requirements = [], onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_percentage: 0,
    is_featured: false,
    selectedDeliverables: [],
    selectedRequirements: []
  });

  // Use API hook if proposalId is provided
  const {
    packages: apiPackages,
    loading,
    error,
    createPackage,
    updatePackage,
    deletePackage,
    refresh
  } = useProposalPackages(proposalId);

  // Define calculatePackagePricing first so it can be used by normalizePackage
  const calculatePackagePricing = useCallback((selectedDelivIds) => {
    const selectedDelivs = deliverables.filter(d => selectedDelivIds.includes(d.id));

    const fixedCost = selectedDelivs
      .filter(d => d.type === 'fixed')
      .reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

    const hourlyItems = selectedDelivs.filter(d => d.type === 'hourly');
    const hourlyEstimate = hourlyItems.reduce((sum, d) => {
      const hours = parseFloat(d.estimated_hours) || 0;
      const rate = parseFloat(d.price) || 0;
      const base = hours * rate;
      return sum + base;
    }, 0);
    const hourlyRange = {
      low: hourlyEstimate * 0.5,
      high: hourlyEstimate * 1.5
    };

    const subscriptionItems = selectedDelivs.filter(d => d.type === 'subscription');
    const monthlyRecurring = subscriptionItems.reduce((sum, d) => {
      const price = parseFloat(d.price) || 0;
      const interval = d.billing_interval;

      if (interval === 'monthly') return sum + price;
      if (interval === 'weekly') return sum + ((price * 52) / 12); // Convert weekly to monthly: (weekly * 52 weeks) / 12 months
      if (interval === 'quarterly') return sum + (price / 3);
      if (interval === 'yearly') return sum + (price / 12);
      return sum;
    }, 0);

    const baseTotal = fixedCost + hourlyEstimate + monthlyRecurring;

    return {
      fixedCost,
      hourlyEstimate,
      hourlyRange,
      monthlyRecurring,
      baseTotal
    };
  }, [deliverables]);

  // Normalize package data from API (convert string numbers to actual numbers)
  // and recalculate pricing breakdown if not present
  const normalizePackage = useCallback((pkg) => {
    if (!pkg) return pkg;

    // Parse API string fields to numbers
    const normalized = {
      ...pkg,
      base_price: parseFloat(pkg.base_price) || 0,
      final_price: parseFloat(pkg.final_price) || 0,
      discount_percentage: parseFloat(pkg.discount_percentage) || 0
    };

    // Extract deliverable IDs from the API response
    // API returns full deliverable objects in 'deliverables' array
    // We need to extract IDs and also map them to match local deliverables
    if (pkg.deliverables && Array.isArray(pkg.deliverables)) {
      // Map API deliverables to local deliverable IDs
      // Local deliverables have id = database ID (from ProposalTabs mapping)
      const deliverableIds = pkg.deliverables
        .map(apiDeliv => {
          // Find matching local deliverable by ID
          // apiDeliv.id is the database ID, local d.id is also the database ID
          const localDeliv = deliverables.find(d => d.id === apiDeliv.id);
          return localDeliv ? localDeliv.id : null;
        })
        .filter(Boolean);

      normalized.deliverable_ids = deliverableIds;

      console.log('[SummaryTab] Normalized package:', {
        packageId: pkg.id,
        apiDeliverables: pkg.deliverables.map(d => ({ id: d.id, title: d.title })),
        localDeliverables: deliverables.map(d => ({ id: d.id, title: d.title })),
        mappedIds: deliverableIds
      });

      // Recalculate pricing breakdown based on deliverables
      const pricing = calculatePackagePricing(deliverableIds);
      normalized.fixed_cost = pricing.fixedCost;
      normalized.hourly_estimate = pricing.hourlyEstimate;
      normalized.hourly_range = pricing.hourlyRange;
      normalized.monthly_recurring = pricing.monthlyRecurring;
    } else if (pkg.deliverable_ids) {
      // Legacy format with just IDs
      const pricing = calculatePackagePricing(pkg.deliverable_ids);
      normalized.fixed_cost = pricing.fixedCost;
      normalized.hourly_estimate = pricing.hourlyEstimate;
      normalized.hourly_range = pricing.hourlyRange;
      normalized.monthly_recurring = pricing.monthlyRecurring;
    } else {
      // Parse existing pricing breakdown fields if present
      normalized.fixed_cost = parseFloat(pkg.fixed_cost) || 0;
      normalized.hourly_estimate = parseFloat(pkg.hourly_estimate) || 0;
      normalized.monthly_recurring = parseFloat(pkg.monthly_recurring) || 0;
      normalized.hourly_range = pkg.hourly_range ? {
        low: parseFloat(pkg.hourly_range.low) || 0,
        high: parseFloat(pkg.hourly_range.high) || 0
      } : { low: 0, high: 0 };
      normalized.deliverable_ids = [];
    }

    // Extract requirement IDs from requirements array if present
    if (pkg.requirements && Array.isArray(pkg.requirements)) {
      normalized.requirement_ids = pkg.requirements.map(r => r.id);
    } else if (!pkg.requirement_ids) {
      normalized.requirement_ids = [];
    }

    return normalized;
  }, [calculatePackagePricing, deliverables]);

  // Use API packages if available, otherwise use local packages
  // Normalize API packages to ensure numeric fields are numbers
  const packages = proposalId
    ? (apiPackages || []).map(normalizePackage)
    : localPackages;

  const openCreateModal = useCallback(() => {
    setEditingPackage(null);
    setFormData({
      name: '',
      description: '',
      discount_percentage: 0,
      is_featured: false,
      selectedDeliverables: [],
      selectedRequirements: []
    });
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description,
      discount_percentage: pkg.discount_percentage || 0,
      is_featured: pkg.is_featured || false,
      selectedDeliverables: pkg.deliverable_ids || [],
      selectedRequirements: pkg.requirement_ids || []
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingPackage(null);
  }, []);

  const handleSave = useCallback(async () => {
    const pricing = calculatePackagePricing(formData.selectedDeliverables);
    const discountMultiplier = (100 - formData.discount_percentage) / 100;
    const finalTotal = pricing.baseTotal * discountMultiplier;

    const packageData = {
      name: formData.name,
      description: formData.description,
      discount_percentage: formData.discount_percentage,
      is_featured: formData.is_featured,
      base_price: pricing.baseTotal,
      final_price: finalTotal,
      // Store additional pricing breakdown in local state for display
      fixed_cost: pricing.fixedCost,
      hourly_estimate: pricing.hourlyEstimate,
      hourly_range: pricing.hourlyRange,
      monthly_recurring: pricing.monthlyRecurring
    };

    if (proposalId) {
      // API mode - persist to backend
      try {
        if (editingPackage && editingPackage.id) {
          // Update existing package
          // Note: Only send fields that the backend API accepts for package updates
          const updatePayload = {
            name: packageData.name,
            description: packageData.description,
            discount_percentage: packageData.discount_percentage,
            is_featured: packageData.is_featured,
            base_price: packageData.base_price,
            deliverable_ids: formData.selectedDeliverables,
            requirement_ids: formData.selectedRequirements
          };
          console.log('[SummaryTab] Updating package with payload:', updatePayload);
          const result = await updatePackage(editingPackage.id, updatePayload);

          if (!result.success) {
            alert(`Failed to update package: ${result.error}`);
            return;
          }
        } else {
          // Create new package
          const result = await createPackage(
            packageData,
            formData.selectedDeliverables,
            formData.selectedRequirements
          );

          if (!result.success) {
            alert(`Failed to create package: ${result.error}`);
            return;
          }
        }
        // Refresh packages from API
        await refresh();
      } catch (err) {
        console.error('[SummaryTab] Package save error:', err);
        alert(`Error saving package: ${err.message}`);
        return;
      }
    } else {
      // Local mode - use callback
      const localPackageData = {
        id: editingPackage?.id || crypto.randomUUID(),
        ...packageData,
        deliverable_ids: formData.selectedDeliverables,
        requirement_ids: formData.selectedRequirements
      };

      if (editingPackage) {
        const newPackages = packages.map(p => p.id === editingPackage.id ? localPackageData : p);
        onChange(newPackages);
      } else {
        onChange([...packages, localPackageData]);
      }
    }

    closeModal();
  }, [formData, editingPackage, packages, onChange, calculatePackagePricing, closeModal, proposalId, createPackage, updatePackage, refresh]);

  const handleDelete = useCallback(async (packageId) => {
    if (!confirm('Are you sure you want to delete this package?')) {
      return;
    }

    if (proposalId) {
      // API mode - delete from backend
      try {
        const result = await deletePackage(packageId);
        if (!result.success) {
          alert(`Failed to delete package: ${result.error}`);
          return;
        }
        // Refresh packages from API
        await refresh();
      } catch (err) {
        console.error('[SummaryTab] Package delete error:', err);
        alert(`Error deleting package: ${err.message}`);
      }
    } else {
      // Local mode - use callback
      onChange(packages.filter(p => p.id !== packageId));
    }
  }, [packages, onChange, proposalId, deletePackage, refresh]);

  const toggleDeliverable = useCallback((delivId) => {
    setFormData(prev => ({
      ...prev,
      selectedDeliverables: prev.selectedDeliverables.includes(delivId)
        ? prev.selectedDeliverables.filter(id => id !== delivId)
        : [...prev.selectedDeliverables, delivId]
    }));
  }, []);

  const toggleRequirement = useCallback((reqId) => {
    setFormData(prev => ({
      ...prev,
      selectedRequirements: prev.selectedRequirements.includes(reqId)
        ? prev.selectedRequirements.filter(id => id !== reqId)
        : [...prev.selectedRequirements, reqId]
    }));
  }, []);

  // Quick create buttons for common packages
  const createQuickPackage = useCallback((type) => {
    let name, description, delivIds, discount, featured;

    const allDelivIds = deliverables.map(d => d.id);
    const thirdCount = Math.ceil(deliverables.length / 3);

    switch(type) {
      case 'mvp':
        name = 'MVP';
        description = 'Essential features to get started quickly';
        delivIds = allDelivIds.slice(0, thirdCount);
        discount = 0;
        featured = false;
        break;
      case 'standard':
        name = 'Standard';
        description = 'Complete solution with all core features';
        delivIds = allDelivIds.slice(0, Math.ceil(deliverables.length * 0.7));
        discount = 10;
        featured = true;
        break;
      case 'optimal':
        name = 'Optimal';
        description = 'Everything included with premium support';
        delivIds = allDelivIds;
        discount = 15;
        featured = false;
        break;
    }

    setFormData({
      name,
      description,
      discount_percentage: discount,
      is_featured: featured,
      selectedDeliverables: delivIds,
      selectedRequirements: requirements.map(r => r.id)
    });
    setShowModal(true);
  }, [deliverables, requirements]);

  return (
    <Container>
      <div style={{ marginBottom: '24px' }}>
        <Title>Summary & Packages</Title>
        <Description>
          Create bundled packages for your proposal. Packages automatically calculate pricing
          based on selected deliverables with support for fixed costs, hourly estimates, and subscriptions.
        </Description>
        {error && (
          <div style={{
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '6px',
            marginTop: '12px',
            fontSize: '14px'
          }}>
            Error: {error}
          </div>
        )}
        {loading && (
          <div style={{
            background: '#d1ecf1',
            border: '1px solid #bee5eb',
            color: '#0c5460',
            padding: '12px 16px',
            borderRadius: '6px',
            marginTop: '12px',
            fontSize: '14px'
          }}>
            Loading packages...
          </div>
        )}
      </div>

      {/* Quick action buttons - always visible */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <CreatePackageButton onClick={() => createQuickPackage('mvp')}>
          MVP
        </CreatePackageButton>
        <CreatePackageButton onClick={() => createQuickPackage('standard')}>
          Standard
        </CreatePackageButton>
        <CreatePackageButton onClick={() => createQuickPackage('optimal')}>
          Optimal
        </CreatePackageButton>
        <CreatePackageButton onClick={openCreateModal}>
          Custom
        </CreatePackageButton>
      </div>

      {
        <PackagesList>
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} $isFeatured={pkg.is_featured}>
              {pkg.is_featured && <FeaturedBadge>Most Popular</FeaturedBadge>}

              <PackageName>{pkg.name}</PackageName>
              <PackageDescription>{pkg.description}</PackageDescription>

              <PricingSection>
                {pkg.fixed_cost > 0 && (
                  <PriceRow>
                    <PriceLabel>Fixed Cost:</PriceLabel>
                    <PriceValue>${pkg.fixed_cost.toFixed(2)}</PriceValue>
                  </PriceRow>
                )}

                {pkg.hourly_estimate > 0 && (
                  <PriceRow>
                    <PriceLabel>Hourly Estimate:</PriceLabel>
                    <PriceValue>
                      ${pkg.hourly_range.low.toFixed(0)} - ${pkg.hourly_range.high.toFixed(0)}
                    </PriceValue>
                  </PriceRow>
                )}

                {pkg.monthly_recurring > 0 && (
                  <PriceRow>
                    <PriceLabel>Monthly Recurring:</PriceLabel>
                    <PriceValue>${pkg.monthly_recurring.toFixed(2)}/mo</PriceValue>
                  </PriceRow>
                )}
              </PricingSection>

              {pkg.discount_percentage > 0 && (
                <DiscountBadge>
                  Save {pkg.discount_percentage}%!
                </DiscountBadge>
              )}

              <TotalPrice>${pkg.final_price.toFixed(2)}</TotalPrice>

              <IncludedSection>
                <SectionTitle>Includes:</SectionTitle>
                <ItemsList>
                  {(() => {
                    const filtered = deliverables.filter(d => pkg.deliverable_ids?.includes(d.id));
                    console.log('[SummaryTab] Rendering package deliverables:', {
                      packageId: pkg.id,
                      packageName: pkg.name,
                      deliverable_ids: pkg.deliverable_ids,
                      allDeliverables: deliverables.map(d => ({ id: d.id, title: d.title })),
                      filteredDeliverables: filtered.map(d => ({ id: d.id, title: d.title }))
                    });
                    return filtered.map(d => (
                      <Item key={d.id}>{d.title}</Item>
                    ));
                  })()}
                </ItemsList>
              </IncludedSection>

              {pkg.requirement_ids?.length > 0 && (
                <IncludedSection>
                  <SectionTitle>Requirements:</SectionTitle>
                  <ItemsList>
                    {requirements
                      .filter(r => pkg.requirement_ids?.includes(r.id))
                      .map(r => (
                        <Item key={r.id}>{r.title}</Item>
                      ))}
                  </ItemsList>
                </IncludedSection>
              )}

              <EditButton onClick={() => openEditModal(pkg)}>
                Edit Package
              </EditButton>
              <DeleteButton onClick={() => handleDelete(pkg.id)}>
                Delete
              </DeleteButton>
            </PackageCard>
          ))}
        </PackagesList>
      }

      {showModal && (
        <Modal onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</ModalTitle>

            <Label>Package Name</Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Professional Package"
            />

            <Label>Description</Label>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what's included"
            />

            <Label>Discount Percentage</Label>
            <Input
              type="number"
              value={formData.discount_percentage}
              onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              max="100"
            />

            <CheckboxLabel style={{ marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              />
              <span>Mark as featured (Most Popular)</span>
            </CheckboxLabel>

            <Label>Select Deliverables</Label>
            <CheckboxGrid>
              {deliverables.map((deliv) => (
                <CheckboxLabel key={deliv.id}>
                  <input
                    type="checkbox"
                    checked={formData.selectedDeliverables.includes(deliv.id)}
                    onChange={() => toggleDeliverable(deliv.id)}
                  />
                  <span>{deliv.title} - ${deliv.price}</span>
                </CheckboxLabel>
              ))}
            </CheckboxGrid>

            <Label>Select Requirements</Label>
            <CheckboxGrid>
              {requirements.map((req) => (
                <CheckboxLabel key={req.id}>
                  <input
                    type="checkbox"
                    checked={formData.selectedRequirements.includes(req.id)}
                    onChange={() => toggleRequirement(req.id)}
                  />
                  <span>{req.title}</span>
                </CheckboxLabel>
              ))}
            </CheckboxGrid>

            <ButtonGroup>
              <SaveButton onClick={handleSave}>
                {editingPackage ? 'Update Package' : 'Create Package'}
              </SaveButton>
              <CancelButton onClick={closeModal}>
                Cancel
              </CancelButton>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

SummaryTab.propTypes = {
  proposalId: PropTypes.string,
  packages: PropTypes.array,
  deliverables: PropTypes.array,
  requirements: PropTypes.array,
  onChange: PropTypes.func
};

export default SummaryTab;
