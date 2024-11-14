import React, { useState, useEffect } from 'react';

function Table({ data }) {
    const [selectedRows, setSelectedRows] = useState({});
    const [filterText, setFilterText] = useState('');
    const [quantities, setQuantities] = useState({});
    const [showDiscontinued, setShowDiscontinued] = useState(false); // Toggle for discontinued items

    useEffect(() => {
        window.filterText = filterText; // Expose to global scope for debugging
        window.selectedRows = selectedRows;
        window.data = data;
    }, [filterText, selectedRows, data]);

    // Handle row selection or deselection
    const handleCheckboxChange = (recordId, isChecked) => {
        setSelectedRows((prevRows) => {
            const updatedRows = { ...prevRows };
            if (isChecked) {
                // Add the row to selectedRows with the current quantity from quantities state
                updatedRows[recordId] = {
                    ...data.find((item) => item.recordId === recordId),
                    quantity: quantities[recordId] || 0, // Use tracked quantity or default to 0
                };
            } else {
                // Remove the row from selectedRows if unchecked
                delete updatedRows[recordId];
            }
            return updatedRows;
        });
    };

    // Handle quantity change for any row (whether selected or not)
    const handleQtyChange = (recordId, quantity) => {
        const newQuantity = quantity.replace(/^0+(?!$)/, ''); // Remove leading zeros, but allow "0" if empty
        setQuantities((prevQuantities) => ({
            ...prevQuantities,
            [recordId]: newQuantity,
        }));

        // Update selectedRows if the row is already selected
        if (selectedRows[recordId]) {
            setSelectedRows((prevRows) => ({
                ...prevRows,
                [recordId]: {
                    ...prevRows[recordId],
                    quantity: parseInt(newQuantity || '0', 10),
                },
            }));
        }
    };

    const handleAddToOrder = () => {
        FileMaker.PerformScript("po * displayJson * callback", JSON.stringify(selectedRows));
    };

    const filteredData = data
        .filter((item) => {
            const isDiscontinued = item.fieldData.ProductCatagory?.toLowerCase().includes("discontinued");
            // Filter out discontinued items if showDiscontinued is false
            return (showDiscontinued || !isDiscontinued) && 
                item.fieldData.ProductName.toLowerCase().includes(filterText.toLowerCase());
        })
        .sort((a, b) => {
            // Sort selected rows to the top
            const isASelected = selectedRows[a.recordId] ? 1 : 0;
            const isBSelected = selectedRows[b.recordId] ? 1 : 0;
            return isBSelected - isASelected;
        });

    return (
        <div>
            <div className="flex flex-row items-center sticky top-0 gap-4 z-10 bg-white py-4">
                <input
                    type="text"
                    placeholder="Filter products..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="px-4 py-2 border rounded w-2/5 text-gray-700"
                />
                <div className="flex items-center gap-2 w-2/5">
                    <label className="text-gray-700">Show Discontinued</label>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={showDiscontinued}
                            onChange={() => setShowDiscontinued((prev) => !prev)}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
                <button
                    onClick={handleAddToOrder}
                    className="py-2 px-4 rounded w-1/5 text-white hover:opacity-90"
                    style={{ backgroundColor: '#364A6F' }}
                >
                    Add to Order
                </button>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
                <table className="min-w-full bg-white shadow-md rounded-lg">
                    <thead>
                        <tr className="sticky top-0 bg-[#364A6F] text-white uppercase text-sm leading-normal z-10">
                            <th className="py-3 px-6 text-left">Select</th>
                            <th className="py-3 px-6 text-left">Product</th>
                            <th className="py-3 px-6 text-left">Bar Code</th>
                            <th className="py-3 px-6 text-left">Price</th>
                            <th className="py-3 px-6 text-left">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700 text-sm font-light">
                        {filteredData.map((item) => (
                            <tr key={item.recordId} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="py-3 px-6 text-left">
                                    <div
                                        onClick={() =>
                                            handleCheckboxChange(item.recordId, !selectedRows[item.recordId])
                                        }
                                        className={`w-6 h-6 border-2 rounded-md flex items-center justify-center cursor-pointer ${
                                            selectedRows[item.recordId] ? 'bg-[#364A6F]' : 'bg-white border-gray-400'
                                        }`}
                                    >
                                        {selectedRows[item.recordId] && (
                                            <svg
                                                className="w-4 h-4 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 15.172l-3.293-3.293a1 1 0 011.414-1.414L10 12.343l5.293-5.293a1 1 0 011.414 1.414l-6 6a 1 1 0 01-1.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-6 text-left">{item.fieldData.ProductName}</td>
                                <td className="py-3 px-6 text-left">{item.fieldData["Bar Code"]}</td>
                                <td className="py-3 px-6 text-left">
                                    {item.fieldData["Purchase Price"] !== ""
                                        ? new Intl.NumberFormat('en-US', {
                                              style: 'currency',
                                              currency: 'USD',
                                          }).format(item.fieldData["Purchase Price"])
                                        : "-"}
                                </td>
                                <td className="py-3 px-6 text-left">
                                    <input
                                        type="number"
                                        id={`qty-${item.recordId}`}
                                        value={quantities[item.recordId] || ''}
                                        min="0"
                                        className="rounded px-2 py-1 w-16"
                                        onChange={(e) => handleQtyChange(item.recordId, e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Table;