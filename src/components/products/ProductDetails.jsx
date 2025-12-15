import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProducts } from '../../hooks/useProducts';
import ProductForm from './ProductForm';
import RelatedProductsSection from './RelatedProductsSection';
import ProductRequirements from './ProductRequirements';

function ProductDetails({ product, onUpdate, onDelete }) {
  const { darkMode } = useTheme();
  const { handleProductUpdate, handleProductDelete } = useProducts();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleUpdateProduct = (updatedProduct) => {
    // The ProductForm component already calls handleProductUpdate from useProducts
    // We just need to call the onUpdate prop to update the UI in MainContent
    onUpdate(updatedProduct);
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const result = await handleProductDelete(product.id);
      if (result.success) {
        // Call the onDelete prop to update the UI in MainContent
        onDelete(product.id);
        setShowDeleteConfirm(false);
      } else {
        // Handle error
        console.error('Failed to delete product:', result.error);
        alert(`Failed to delete product: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(`Error deleting product: ${error.message}`);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  if (isEditing) {
    return (
      <ProductForm
        product={product}
        onSubmit={handleUpdateProduct}
        onCancel={handleCancelEdit}
        isEditing={true}
      />
    );
  }

  return (
    <div className={`h-[calc(90vh-3.5rem)] flex flex-col overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Fixed Header */}
      <div className={`flex-shrink-0 p-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <h2 className={`text-xl font-bold truncate ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {product.name}
          </h2>
          <div className="flex space-x-1 ml-4">
            <button
              onClick={handleEditClick}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary-hover flex items-center"
              title="Edit Product"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors duration-200"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Compact Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Price */}
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Price
            </h3>
            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              ${product.price.toFixed(2)}
              {product.is_subscription && product.subscription_frequency && (
                <span className="text-xs font-normal ml-1">
                  /{product.subscription_frequency}
                </span>
              )}
              {product.is_one_time && (
                <span className="text-xs font-normal ml-1">(one-time)</span>
              )}
            </p>
          </div>

          {/* Subscription Details */}
          {product.is_subscription && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <h3 className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Usage
              </h3>
              <div className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {product.included_units > 0 ? (
                  <p>{product.included_units} {product.unit_type || 'units'}</p>
                ) : (
                  <p>Pay-as-you-go</p>
                )}
                {product.overage_rate > 0 && (
                  <p className="text-xs mt-0.5">
                    ${product.overage_rate.toFixed(2)}/{product.unit_type || 'unit'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div className="mb-4">
            <h3 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {product.description}
            </p>
          </div>
        )}

        {/* Customer Requirements */}
        {product.metadata?.requirements && product.metadata.requirements.length > 0 && (
          <ProductRequirements
            requirements={product.metadata.requirements}
            darkMode={darkMode}
          />
        )}

        {/* Related Products Section */}
        <RelatedProductsSection
          productId={product.id}
          productName={product.name}
          onEdit={true}
        />
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-lg max-w-md w-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ProductDetails.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    description: PropTypes.string
  }).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};

export default ProductDetails;