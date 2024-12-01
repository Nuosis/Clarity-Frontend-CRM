import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import CustomerDetails from './CustomerDetails';

const Customers = ({ onClose }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const dispatch = useDispatch();
    const billablesData = useSelector(state => state.billables.billablesData);
    console.log({billablesData});

    const customerSummary = useMemo(() => {
        const summary = {};

        if (!billablesData) return [];

        billablesData.forEach(entry => {
            const entryData = entry.fieldData || entry;
            if (entryData.f_dnb === "1" || entryData.f_omit === "1") return;

            const customerName = entryData["Customers::Name"];
            if (!customerName) return;

            if (!summary[customerName]) {
                summary[customerName] = {
                    totalHours: 0,
                    totalAmount: 0,
                    currency: entryData["Customers::f_USD"] === "1" ? "USD" : 
                              entryData["Customers::f_EUR"] === "1" ? "EUR" : "CAD"
                };
            }

            const hours = parseFloat(entryData.Billable_Time_Rounded) || 0;
            const rate = parseFloat(entryData["Customers::chargeRate"]) || 0;
            
            summary[customerName].totalHours += hours;
            summary[customerName].totalAmount += hours * rate;
        });

        return Object.entries(summary)
            .map(([name, data]) => ({
                name,
                ...data,
                totalHours: Number(data.totalHours.toFixed(2)),
                totalAmount: Number(data.totalAmount.toFixed(2))
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount);
    }, [billablesData]);

    const handleCustomerClick = (customerName) => {
        setSelectedCustomer(customerName);
        setShowDetails(true);
    };

    return (
        <div className="flex-1 h-full">
            <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-6 p-4">
                    <h1 className="text-2xl font-bold">Customer Summary</h1>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full"
                        aria-label="Close"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-gray-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total Hours
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total Amount
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Currency
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {customerSummary.map((customer, index) => (
                                <tr 
                                    key={customer.name}
                                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 cursor-pointer`}
                                    onClick={() => handleCustomerClick(customer.name)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {customer.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {customer.totalHours}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {customer.totalAmount.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {customer.currency}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg w-4/5 h-4/5 overflow-auto">
                        <CustomerDetails 
                            onClose={() => setShowDetails(false)} 
                            customer={selectedCustomer}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
