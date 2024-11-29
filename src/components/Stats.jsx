import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import Charts from "./Chart";

const Stats = ({ onClose }) => {
  const billables = useSelector(state => state.billables.billablesData);
  
  const [hrsFilter, setHrsFilter] = useState("Today");
  const [billablesFilter, setBillablesFilter] = useState("Rolling Last Year");
  const [selectedCustomer, setSelectedCustomer] = useState("All");

  let pieTitle;

  const getLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
  };

  const isBillable = (entry) => {
    // Access properties directly since we're already at fieldData level
    return entry.f_dnb !== "1" && entry.f_omit !== "1";
  };

  const convertToCAD = (amount, entry) => {
    // Access properties directly since we're already at fieldData level
    if (entry["Customers::f_USD"] === "1") {
      return amount * 1.35; // USD to CAD
    }
    if (entry["Customers::f_EUR"] === "1") {
      return amount * 1.45; // EUR to CAD
    }
    return amount; // Already in CAD
  };

  const getISOWeek = (date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  };

  const getWeekKey = (date) => {
    const weekNum = getISOWeek(date);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  const filterByDate = (data, range) => {
    const today = new Date();
    const filters = {
      Today: (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return entryDate.getTime() === todayStart.getTime();
      },
      "This Week": (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return entryDate >= weekStart && entryDate <= weekEnd;
      },
      "This Month": (entry) => {
        return entry.year === today.getFullYear() && 
                entry.month === (today.getMonth() + 1);
      },
      "Last 12 Weeks": (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        const twelveWeeksAgo = new Date(today);
        twelveWeeksAgo.setDate(today.getDate() - (12 * 7));
        const dayOfWeek = twelveWeeksAgo.getDay();
        if (dayOfWeek === 1) {
            twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 1);
        } else {
            twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - ((dayOfWeek + 6) % 7));
        }
        twelveWeeksAgo.setHours(0, 0, 0, 0);
        return entryDate >= twelveWeeksAgo && entryDate <= today;
      },
      "Last 6 Months": (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        return entryDate >= sixMonthsAgo;
      },
      "Rolling Last Year": (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        // Get last year's same month and set the date to the first day of that month
        const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), 1);
        oneYearAgo.setHours(0, 0, 0, 0);
        return entryDate >= oneYearAgo;
      },
      "Last 5 Years": (entry) => {
        const entryDate = getLocalDate(entry.DateStart);
        const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), 1);
        fiveYearsAgo.setHours(0, 0, 0, 0);
        return entryDate >= fiveYearsAgo;
      }
    };

    return data.filter((entry) => filters[range](entry) && isBillable(entry));
  };

  const aggregateHrsData = (data, filter) => {
    try {
      const filteredData = filterByDate(data, filter);
      const result = {
        byGroup: {},
        totalHours: 0,
      };
  
      filteredData.forEach((entry) => {
        // For Today filter, group by project name
        // For other filters (This Week, This Month), group by customer
        const groupKey = filter === "Today" 
          ? entry["customers_Projects::projectName"] || "Unspecified Project"
          : entry["Customers::Name"];
          
        const billableTime = entry.Billable_Time_Rounded;
        result.byGroup[groupKey] = (result.byGroup[groupKey] || 0) + billableTime;
        result.totalHours += billableTime;
      });

      pieTitle = `Total Hours: ${result.totalHours.toFixed(2)}`;
      return result.byGroup;
    } catch (error) {
      return { byGroup: {}, totalHours: 0 };
    }
  };

  const aggregateBillablesData = (data, filter, customer) => {
    try {
      let filteredData = filterByDate(data, filter);
  
      if (customer !== "All") {
        filteredData = filteredData.filter(
          (entry) => entry["customers_Projects::_custID"] === customer
        );
      }
  
      const isWeekly = filter === "Last 12 Weeks";
      const today = new Date();
      const aggregated = {};
      
      if (isWeekly) {
        // Create week buckets for the last 12 weeks
        for (let i = 0; i < 12; i++) {
          const weekDate = new Date(today);
          weekDate.setDate(today.getDate() - (i * 7));
          const weekKey = getWeekKey(weekDate);
          aggregated[weekKey] = 0;
        }

        // Aggregate data into week buckets
        filteredData.forEach((entry) => {
          const date = getLocalDate(entry.DateStart);
          const weekKey = getWeekKey(date);
          
          if (weekKey in aggregated) {
            const hours = entry.Billable_Time_Rounded;
            const rate = entry["Customers::chargeRate"];
            const total = convertToCAD(hours * rate, entry);
            aggregated[weekKey] += total;
          }
        });
      } else {
        // Monthly aggregation
        filteredData.forEach((entry) => {
          const date = getLocalDate(entry.DateStart);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const hours = entry.Billable_Time_Rounded;
          const rate = entry["Customers::chargeRate"];
          const total = convertToCAD(hours * rate, entry);
          aggregated[key] = (aggregated[key] || 0) + total;
        });
      }

      // Sort chronologically
      const sortedKeys = Object.keys(aggregated).sort();
      const sortedAggregated = {};
      sortedKeys.forEach(key => {
        sortedAggregated[key] = aggregated[key];
      });

      return sortedAggregated;
    } catch (error) {
      return {};
    }
  };

  const hrsData = useMemo(() => {
    return aggregateHrsData(billables, hrsFilter);
  }, [billables, hrsFilter]);

  const billablesData = useMemo(() => {
    return aggregateBillablesData(billables, billablesFilter, selectedCustomer);
  }, [billables, billablesFilter, selectedCustomer]);

  return (
    <div id="chart-container" className="p-4 bg-white min-h-screen">
      <div id="header" className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Stats Dashboard</h1>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 8.586L3.707 2.293a1 1 0 10-1.414 1.414L8.586 10l-6.293 6.293a1 1 0 101.414 1.414L10 11.414l6.293 6.293a1 1 0 001.414-1.414L11.414 10l6.293-6.293a1 1 0 00-1.414-1.414L10 8.586z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div id="charts" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-2">
          <div className="mb-4">
            <label htmlFor="hrsFilter" className="mr-2">
              Hrs Filter:
            </label>
            <div className="relative">
              <select
                id="hrsFilter"
                value={hrsFilter}
                onChange={(e) => setHrsFilter(e.target.value)}
                className="appearance-none border border-gray-300 bg-white px-4 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
          </div>
          <Charts type="Pie" data={hrsData} title={pieTitle} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            <div id="custFilter" className="flex flex-col">
              <label htmlFor="selectedCustomer" className="font-normal">
                Customer:
              </label>
              <select
                id="selectedCustomer"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="appearance-none border border-gray-300 bg-white px-4 py-1 rounded-lg max-w-60 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option>All</option>
                {[...new Set(billables.map((entry) => entry["customers_Projects::_custID"]))].map(
                  (custID) => {
                    const customerName = billables.find(
                      (entry) => entry["customers_Projects::_custID"] === custID
                    )?.["Customers::Name"] || "Unknown";
                    return (
                      <option key={custID} value={custID}>
                        {customerName}
                      </option>
                    );
                  }
                )}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="billablesFilter" className="mr-2">
                Billables Filter:
              </label>
              <div className="relative">
                <select
                  id="billablesFilter"
                  value={billablesFilter}
                  onChange={(e) => setBillablesFilter(e.target.value)}
                  className="appearance-none border border-gray-300 bg-white px-4 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                >
                  <option>Last 12 Weeks</option>
                  <option>Last 6 Months</option>
                  <option>Rolling Last Year</option>
                  <option>Last 5 Years</option>
                </select>
              </div>
            </div>
          </div>
          <Charts
            type="Line"
            data={billablesData}
            title="Billables Over Time (CAD)"
            options={{ 
              projection: "currentMonth",
              showProjection: true
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Stats;
