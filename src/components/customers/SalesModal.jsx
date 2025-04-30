import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { useAppState } from '../../context/AppStateContext';
import { useSnackBar } from '../../context/SnackBarContext';
import { useSales } from '../../hooks/useSales';
import { useProducts } from '../../hooks/useProducts';

function SalesModal({ 
  customer, 
  isOpen, 
  onClose 
}) {
  const { darkMode } = useTheme();
  const { showError, showSuccess } = useSnackBar();
  const { handleSaleCreate } = useSales();
  const { products } = useProducts();
  
  // Form state
  const [formData, setFormData] = useState({
    product_id: '',
    product_name: '',
    quantity: 1,
    unit_price: '',
    total_price: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        product_id: '',
        product_name: '',
        quantity: 1,
        unit_price: '',
        total_price: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
  }, [isOpen]);
  
  // Update total price when quantity or unit price changes
  useEffect(() => {
    if (formData.unit_price && formData.quantity) {
      const total = parseFloat(formData.unit_price) * parseFloat(formData.quantity);
      setFormData(prev => ({
        ...prev,
        total_price: total.toFixed(2)
      }));
    }
  }, [formData.unit_price, formData.quantity]);
  
  // Handle product selection
  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const selectedProduct = products.find(p => p.id === productId);
    
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        unit_price: selectedProduct.price ? selectedProduct.price.toString() : '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        product_id: '',
        product_name: '',
        unit_price: '',
      }));
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.product_id) {
      showError('Please select a product');
      return;
    }
    
    if (!formData.unit_price || parseFloat(formData.unit_price) <= 0) {
      showError('Please enter a valid price');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare sale data
      const saleData = {
        customer_id: customer.id,
        product_id: formData.product_id,
        product_name: formData.product_name,
        quantity: parseFloat(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        total_price: parseFloat(formData.total_price),
        date: formData.date,
      };
      
      // Create sale in Supabase
      const result = await handleSaleCreate(saleData);
      
      if (result.success) {
        showSuccess('Sale created successfully');
        onClose();
      } else {
        showError(`Failed to create sale: ${result.error}`);
      }
    } catch (error) {
      showError(`Error creating sale: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`
        w-full max-w-lg rounded-lg shadow-xl
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
        p-6
      `}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Create New Sale for {customer.Name || 'Customer'}</h2>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Product Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Product/Service</label>
            <div className={`
              relative rounded-md border
              ${darkMode
                ? 'bg-gray-600 border-gray-500 text-white'
                : 'bg-white border-gray-300 text-gray-700'}
            `}>
              <select
                value={formData.product_id}
                onChange={handleProductSelect}
                className={`
                  w-full px-4 py-3 rounded-md appearance-none bg-transparent
                  focus:outline-none focus:ring-2 focus:ring-primary
                `}
                required
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className={`
                w-full px-4 py-3 rounded-md border
                ${darkMode
                  ? 'bg-gray-600 border-gray-500 text-white'
                  : 'bg-white border-gray-300 text-gray-700'}
                focus:outline-none focus:ring-2 focus:ring-primary
              `}
              required
            />
          </div>
          
          {/* Price and Quantity */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Unit Price</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({...formData, unit_price: e.target.value})}
                className={`
                  w-full px-4 py-3 rounded-md border
                  ${darkMode
                    ? 'bg-gray-600 border-gray-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'}
                  focus:outline-none focus:ring-2 focus:ring-primary
                `}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                className={`
                  w-full px-4 py-3 rounded-md border
                  ${darkMode
                    ? 'bg-gray-600 border-gray-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700'}
                  focus:outline-none focus:ring-2 focus:ring-primary
                `}
                required
              />
            </div>
          </div>
          
          {/* Total Price (Calculated) */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Total Price</label>
            <input
              type="text"
              value={formData.total_price ? `$${formData.total_price}` : ''}
              readOnly
              className={`
                w-full px-4 py-3 rounded-md border
                ${darkMode
                  ? 'bg-gray-600 border-gray-500 text-white'
                  : 'bg-white border-gray-300 text-gray-700'}
              `}
            />
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-4 py-3 rounded-md
                ${darkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                transition-colors duration-150
              `}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-3 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors duration-150"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

SalesModal.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    Name: PropTypes.string
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default SalesModal;