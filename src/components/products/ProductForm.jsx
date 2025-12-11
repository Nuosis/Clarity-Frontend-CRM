import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useProducts } from '../../hooks/useProducts';
import { useSnackBar } from '../../context/SnackBarContext';

function ProductForm({ product, onSubmit, onCancel, isEditing = false }) {
  const { darkMode } = useTheme();
  const { handleProductCreate, handleProductUpdate } = useProducts();
  const { showError, showSuccess } = useSnackBar();
  
  const [formData, setFormData] = useState({
    // Only include ID if editing an existing product
    ...(isEditing && product?.id ? { id: product.id } : {}),
    name: product?.name || '',
    price: product?.price || 0,
    description: product?.description || '',
    is_subscription: product?.is_subscription || false,
    subscription_frequency: product?.subscription_frequency || 'monthly',
    is_one_time: product?.is_one_time || false,
    included_units: product?.included_units || 0,
    unit_type: product?.unit_type || '',
    overage_rate: product?.overage_rate || 0
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;

    // Handle checkboxes
    if (type === 'checkbox') {
      processedValue = checked;
    }
    // Convert numeric fields
    else if (name === 'price' || name === 'overage_rate') {
      processedValue = parseFloat(value) || 0;
    }
    else if (name === 'included_units') {
      processedValue = parseInt(value) || 0;
    }

    setFormData({
      ...formData,
      [name]: processedValue
    });

    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than zero';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validate()) {
      setIsSubmitting(true);
      try {
        if (isEditing) {
          // If editing, use the update function
          const result = await handleProductUpdate(formData.id, formData);
          if (result.success) {
            showSuccess(`Product "${formData.name}" updated successfully`);
            onSubmit(result.data || formData);
          } else {
            showError(result.error || 'Failed to update product');
          }
        } else {
          // If creating, use the create function
          const result = await handleProductCreate(formData);
          if (result.success) {
            showSuccess(`Product "${formData.name}" created successfully`);
            onSubmit(result.data || formData);
          } else {
            showError(result.error || 'Failed to create product');
          }
        }
      } catch (error) {
        showError(error.message || 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Show validation errors using SnackBar
      const errorMessage = Object.values(errors).filter(Boolean)[0];
      if (errorMessage) {
        showError(errorMessage);
      }
    }
  };

  return (
    <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        {isEditing ? 'Edit Product' : 'Add New Product'}
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label 
            htmlFor="name" 
            className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Product Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode 
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600' 
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              ${errors.name ? (darkMode ? 'border-red-500' : 'border-red-500') : ''}
            `}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>
        
        <div className="mb-4">
          <label 
            htmlFor="price" 
            className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Price ($)
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
            min="0"
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode 
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600' 
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
              ${errors.price ? (darkMode ? 'border-red-500' : 'border-red-500') : ''}
            `}
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-500">{errors.price}</p>
          )}
        </div>
        
        <div className="mb-4">
          <label
            htmlFor="description"
            className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
            `}
          />
        </div>

        {/* Product Type Checkboxes */}
        <div className="mb-4 border-t pt-4">
          <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Product Type
          </h3>

          <div className="flex gap-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_one_time"
                checked={formData.is_one_time}
                onChange={handleChange}
                className="mr-2"
              />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                One-Time Purchase
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_subscription"
                checked={formData.is_subscription}
                onChange={handleChange}
                className="mr-2"
              />
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                Subscription
              </span>
            </label>
          </div>
        </div>

        {/* Subscription Fields - Show only if is_subscription is checked */}
        {formData.is_subscription && (
          <div className="mb-4 border-t pt-4">
            <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Subscription Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Billing Frequency
                </label>
                <select
                  name="subscription_frequency"
                  value={formData.subscription_frequency}
                  onChange={handleChange}
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                  `}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Unit Type (e.g., minutes, hours, API calls)
                </label>
                <input
                  type="text"
                  name="unit_type"
                  value={formData.unit_type}
                  onChange={handleChange}
                  placeholder="minutes"
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                  `}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Included Units (0 for pay-as-you-go)
                </label>
                <input
                  type="number"
                  name="included_units"
                  value={formData.included_units}
                  onChange={handleChange}
                  min="0"
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                  `}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Set to 0 for pure pay-as-you-go (no usage = no charge)
                </p>
              </div>

              <div>
                <label className={`block mb-2 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Overage Rate (per unit)
                </label>
                <input
                  type="number"
                  name="overage_rate"
                  value={formData.overage_rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className={`
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-600'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'}
                  `}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Rate charged per additional unit beyond included amount
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditing ? 'Updating...' : 'Creating...') 
              : (isEditing ? 'Update' : 'Add') + ' Product'
            }
          </button>
        </div>
      </form>
    </div>
  );
}

ProductForm.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.number,
    description: PropTypes.string
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isEditing: PropTypes.bool
};

export default ProductForm;