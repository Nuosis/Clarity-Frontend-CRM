import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProducts } from '../../hooks/useProducts';
import ProductForm from './ProductForm';
import RelatedProductsSection from './RelatedProductsSection';

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
    <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          {product.name}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={handleDeleteClick}
            className={`
              p-1 flex items-center justify-center w-8 h-8
              text-gray-400 hover:text-red-600
              transition-colors duration-200
            `}
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Price
          </h3>
          <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            ${product.price.toFixed(2)}
            {product.is_subscription && product.subscription_frequency && (
              <span className="text-sm font-normal ml-2">
                /{product.subscription_frequency}
              </span>
            )}
            {product.is_one_time && (
              <span className="text-sm font-normal ml-2">(one-time)</span>
            )}
          </p>
        </div>

        {product.is_subscription && (
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Subscription Details
            </h3>
            <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {product.included_units > 0 ? (
                <p>Includes {product.included_units} {product.unit_type || 'units'}</p>
              ) : (
                <p>Pay-as-you-go (no base usage)</p>
              )}
              {product.overage_rate > 0 && (
                <p className="mt-1">
                  ${product.overage_rate.toFixed(2)} per additional {product.unit_type || 'unit'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Description
        </h3>
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {product.description || 'No description available.'}
        </p>
      </div>

      {/* Related Products Section */}
      <div className="mt-6">
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