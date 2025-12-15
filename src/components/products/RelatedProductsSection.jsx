import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProductRelationships } from '../../hooks/useProductRelationships';
import { useProducts } from '../../hooks/useProducts';
import { useSnackBar } from '../../context/SnackBarContext';
import {
  RELATIONSHIP_TYPES,
  getRelationshipTypeLabel,
  getRelationshipTypeDescription
} from '../../services/productRelationshipsService';

function RelatedProductsSection({ productId, productName, onEdit = false }) {
  const { darkMode } = useTheme();
  const { products } = useProducts();
  const {
    loading,
    relationships,
    loadRelationships,
    handleDeleteRelationship,
    getAddons,
    getPrerequisites,
    getBundleItems,
    getUpsells,
    getRelationshipsByType
  } = useProductRelationships(productId);
  const { showSuccess, showError } = useSnackBar();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (productId) {
      loadRelationships();
    }
  }, [productId, loadRelationships]);

  const handleDelete = async (relationshipId, childProductName) => {
    if (window.confirm(`Remove "${childProductName}" from related products?`)) {
      const result = await handleDeleteRelationship(relationshipId);
      if (result.success) {
        showSuccess('Product relationship removed');
      } else {
        showError(result.error || 'Failed to remove relationship');
      }
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  const renderRelationshipGroup = (title, description, items, type) => {
    if (items.length === 0 && !onEdit) return null;

    return (
      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h4 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {title}
            </h4>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              {description}
            </p>
          </div>
          {onEdit && (
            <button
              onClick={() => {
                setSelectedType(type);
                setShowAddModal(true);
              }}
              className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover flex-shrink-0"
            >
              + Add
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
            No {title.toLowerCase()} configured
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => (
              <div
                key={item.id}
                className={`
                  p-2 rounded border text-sm
                  ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                `}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {getProductName(item.child_product_id)}
                      </span>
                      {item.is_required && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded flex-shrink-0">
                          Required
                        </span>
                      )}
                      {item.quantity_multiplier > 1 && (
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>
                          ×{item.quantity_multiplier}
                        </span>
                      )}
                    </div>
                    {item.price_override !== null && (
                      <div className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        ${parseFloat(item.price_override).toFixed(2)}
                      </div>
                    )}
                  </div>
                  {onEdit && (
                    <button
                      onClick={() => handleDelete(item.id, getProductName(item.child_product_id))}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200 flex-shrink-0"
                      title="Remove"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading && relationships.length === 0) {
    return (
      <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Loading relationships...
      </div>
    );
  }

  const addons = getAddons();
  const prerequisites = getPrerequisites();
  const bundleItems = getBundleItems();
  const upsells = getUpsells();
  const requiredChoices = getRelationshipsByType(RELATIONSHIP_TYPES.REQUIRED_CHOICE);

  // Group required choices by exclusive_group
  const requiredChoiceGroups = requiredChoices.reduce((groups, item) => {
    const groupName = item.exclusive_group || 'default';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(item);
    return groups;
  }, {});

  const hasAnyRelationships = addons.length > 0 || prerequisites.length > 0 ||
                              bundleItems.length > 0 || upsells.length > 0 ||
                              requiredChoices.length > 0;

  if (!hasAnyRelationships && !onEdit) {
    return null;
  }

  return (
    <div className={`rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <h3 className={`text-base font-bold p-3 border-b ${darkMode ? 'text-white border-gray-700' : 'text-gray-800 border-gray-300'}`}>
        Related Products
      </h3>
      <div className="p-3 space-y-3">

      {renderRelationshipGroup(
        'Add-ons',
        getRelationshipTypeDescription(RELATIONSHIP_TYPES.ADDON),
        addons,
        RELATIONSHIP_TYPES.ADDON
      )}

      {renderRelationshipGroup(
        'Prerequisites',
        getRelationshipTypeDescription(RELATIONSHIP_TYPES.PREREQUISITE),
        prerequisites,
        RELATIONSHIP_TYPES.PREREQUISITE
      )}

      {renderRelationshipGroup(
        'Bundle Items',
        getRelationshipTypeDescription(RELATIONSHIP_TYPES.BUNDLE_ITEM),
        bundleItems,
        RELATIONSHIP_TYPES.BUNDLE_ITEM
      )}

      {renderRelationshipGroup(
        'Upsells',
        getRelationshipTypeDescription(RELATIONSHIP_TYPES.UPSELL),
        upsells,
        RELATIONSHIP_TYPES.UPSELL
      )}

      {/* Pricing Tiers Section - Always visible in edit mode */}
      {(Object.keys(requiredChoiceGroups).length > 0 || onEdit) && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h4 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Pricing Tiers
              </h4>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                Customer must select one option
              </p>
            </div>
            {onEdit && (
              <button
                onClick={() => {
                  setSelectedType(RELATIONSHIP_TYPES.REQUIRED_CHOICE);
                  setShowAddModal(true);
                }}
                className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover flex-shrink-0"
              >
                + Add
              </button>
            )}
          </div>

          {Object.keys(requiredChoiceGroups).length === 0 ? (
            <p className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>
              No pricing tiers configured. Add mutually exclusive options.
            </p>
          ) : (
            Object.entries(requiredChoiceGroups).map(([groupName, items]) => (
            <div key={groupName} className="mb-2">
              <h5 className={`text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                {groupName.charAt(0).toUpperCase() + groupName.slice(1).replace(/_/g, ' ')}
              </h5>

              <div className="space-y-1.5">
                {items.map(item => {
                  const childProduct = products.find(p => p.id === item.child_product_id);
                  return (
                    <div
                      key={item.id}
                      className={`
                        p-2 rounded border-l-2 border-blue-500 text-sm
                        ${darkMode ? 'bg-gray-800' : 'bg-blue-50'}
                      `}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {getProductName(item.child_product_id)}
                            </span>
                            {item.is_required && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded flex-shrink-0">
                                Required
                              </span>
                            )}
                          </div>
                          {childProduct && (
                            <div className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              ${parseFloat(childProduct.price).toFixed(2)}
                              {childProduct.is_subscription && `/${childProduct.subscription_frequency}`}
                              {childProduct.is_subscription && childProduct.included_units > 0 && (
                                <span className="ml-1">
                                  ({childProduct.included_units} {childProduct.unit_type})
                                </span>
                              )}
                            </div>
                          )}
                          {item.price_override !== null && (
                            <div className={`text-xs mt-0.5 font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              Bundle: ${parseFloat(item.price_override).toFixed(2)}
                            </div>
                          )}
                        </div>
                        {onEdit && (
                          <button
                            onClick={() => handleDelete(item.id, getProductName(item.child_product_id))}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200 flex-shrink-0"
                            title="Remove"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
          )}
        </div>
      )}

      {showAddModal && (
        <AddRelationshipModal
          darkMode={darkMode}
          parentProductId={productId}
          parentProductName={productName}
          relationshipType={selectedType}
          products={products}
          existingRelationships={relationships}
          onClose={() => {
            setShowAddModal(false);
            setSelectedType(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setSelectedType(null);
            loadRelationships();
          }}
        />
      )}
      </div>
    </div>
  );
}

function AddRelationshipModal({
  darkMode,
  parentProductId,
  parentProductName,
  relationshipType,
  products,
  existingRelationships,
  onClose,
  onSuccess
}) {
  const { handleCreateRelationship } = useProductRelationships();
  const { showSuccess, showError } = useSnackBar();

  const [formData, setFormData] = useState({
    child_product_id: '',
    is_required: false,
    quantity_multiplier: 1,
    price_override: '',
    exclusive_group: relationshipType === RELATIONSHIP_TYPES.REQUIRED_CHOICE ? 'pricing_tiers' : ''
  });

  const availableProducts = products.filter(p =>
    p.id !== parentProductId &&
    !existingRelationships.some(rel =>
      rel.child_product_id === p.id &&
      rel.relationship_type === relationshipType
    )
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const relationshipData = {
      parent_product_id: parentProductId,
      child_product_id: formData.child_product_id,
      relationship_type: relationshipType,
      is_required: formData.is_required,
      quantity_multiplier: parseInt(formData.quantity_multiplier) || 1,
      price_override: formData.price_override ? parseFloat(formData.price_override) : null,
      exclusive_group: formData.exclusive_group || null
    };

    const result = await handleCreateRelationship(relationshipData);

    if (result.success) {
      showSuccess('Related product added successfully');
      onSuccess();
    } else {
      showError(result.error || 'Failed to add related product');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`p-6 rounded-lg shadow-lg max-w-md w-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
        <h3 className="text-xl font-bold mb-4">
          Add {getRelationshipTypeLabel(relationshipType)} to "{parentProductName}"
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Product
            </label>
            <select
              value={formData.child_product_id}
              onChange={(e) => setFormData({ ...formData, child_product_id: e.target.value })}
              required
              className={`
                w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              `}
            >
              <option value="">Select a product...</option>
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${parseFloat(product.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="mr-2"
              />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                Required
              </span>
            </label>
          </div>

          <div className="mb-4">
            <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Quantity Multiplier
            </label>
            <input
              type="number"
              min="1"
              value={formData.quantity_multiplier}
              onChange={(e) => setFormData({ ...formData, quantity_multiplier: e.target.value })}
              className={`
                w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              `}
            />
          </div>

          <div className="mb-4">
            <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Special Price (optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price_override}
              onChange={(e) => setFormData({ ...formData, price_override: e.target.value })}
              placeholder="Leave blank to use regular price"
              className={`
                w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              `}
            />
          </div>

          {relationshipType === RELATIONSHIP_TYPES.REQUIRED_CHOICE && (
            <div className="mb-6">
              <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Exclusive Group Name
              </label>
              <input
                type="text"
                value={formData.exclusive_group}
                onChange={(e) => setFormData({ ...formData, exclusive_group: e.target.value })}
                placeholder="e.g., pricing_tiers"
                className={`
                  w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                `}
              />
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Products in the same group are mutually exclusive (customer picks one)
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
            >
              Add Relationship
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

RelatedProductsSection.propTypes = {
  productId: PropTypes.string.isRequired,
  productName: PropTypes.string.isRequired,
  onEdit: PropTypes.bool
};

AddRelationshipModal.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  parentProductId: PropTypes.string.isRequired,
  parentProductName: PropTypes.string.isRequired,
  relationshipType: PropTypes.string.isRequired,
  products: PropTypes.array.isRequired,
  existingRelationships: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired
};

export default RelatedProductsSection;
