import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchBillablesData } from "../store/billablesSlice";
import Charts from "./Chart";

const Stats = ({ onClose }) => {
  const dispatch = useDispatch();
  // Use shallowEqual to prevent unnecessary re-renders
  const billables = useSelector(state => {
    console.log('Raw billables data:', state.billables.billablesData);
    return state.billables.billablesData;
  }, (prev, next) => prev === next || (prev?.length === next?.length && prev?.every((item, i) => item.recordId === next[i].recordId)));
  const loading = useSelector(state => state.billables.loading);
  const lastFetched = useSelector(state => state.billables.lastFetched);
  
  const [hrsFilter, setHrsFilter] = useState("Today");
  const [billablesFilter, setBillablesFilter] = useState("Rolling Last Year");
  const [selectedCustomer, setSelectedCustomer] = useState("All");

  // Fetch data initially and refresh every minute
  useEffect(() => {
    // Initial fetch
    dispatch(fetchBillablesData({ action: 'read' }));

    // Set up refresh interval
    const intervalId = setInterval(() => {
      dispatch(fetchBillablesData({ action: 'read' }));
    }, 60000); // Refresh every minute

    return () => clearInterval(intervalId);
  }, [dispatch]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleHrsFilterChange = useCallback((e) => {
    setHrsFilter(e.target.value);
  }, []);

  const handleBillablesFilterChange = useCallback((e) => {
    setBillablesFilter(e.target.value);
  }, []);

  const handleCustomerChange = useCallback((e) => {
    setSelectedCustomer(e.target.value);
  }, []);

  const getLocalDate = (dateString) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
  };

  const isBillable = (entry) => {
    if (!entry?.fieldData) return false;
    const { f_dnb, f_omit } = entry.fieldData;
    return f_dnb !== "1" && f_omit !== "1";
  };

  const convertToCAD = (amount, entry) => {
    if (!entry?.fieldData) return amount;
    const { "Customers::f_USD": isUSD, "Customers::f_EUR": isEUR } = entry.fieldData;
    if (isUSD === "1") {
      return amount * 1.40; // USD to CAD
    }
    if (isEUR === "1") {
      return amount * 1.5; // EUR to CAD
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

  // Memoize filter functions to prevent unnecessary recalculations
  const filterByDate = useMemo(() => {
    return (data, range) => {
      if (!Array.isArray(data)) return [];
      
      const today = new Date();
      const filters = {
        Today: (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const todayEnd = new Date(todayStart);
          todayEnd.setHours(23, 59, 59, 999);
          return entryDate >= todayStart && entryDate <= todayEnd;
        },
        "This Week": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return entryDate >= weekStart && entryDate <= weekEnd;
        },
        "This Month": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          return entryDate >= monthStart && entryDate <= monthEnd;
        },
        "Last 12 Weeks": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const twelveWeeksAgo = new Date(today);
          twelveWeeksAgo.setDate(today.getDate() - (12 * 7));
          twelveWeeksAgo.setHours(0, 0, 0, 0);
          return entryDate >= twelveWeeksAgo && entryDate <= today;
        },
        "Last 6 Months": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
          sixMonthsAgo.setHours(0, 0, 0, 0);
          return entryDate >= sixMonthsAgo;
        },
        "Rolling Last Year": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), 1);
          oneYearAgo.setHours(0, 0, 0, 0);
          return entryDate >= oneYearAgo;
        },
        "Last 5 Years": (entry) => {
          if (!entry?.fieldData?.DateStart) return false;
          const entryDate = getLocalDate(entry.fieldData.DateStart);
          const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), 1);
          fiveYearsAgo.setHours(0, 0, 0, 0);
          return entryDate >= fiveYearsAgo;
        }
      };

      console.log(`Filtering ${data.length} records for range: ${range}`);
      const filtered = data.filter((entry) => {
        try {
          const dateFiltered = filters[range](entry);
          const billableFiltered = isBillable(entry);
          // if (!dateFiltered || !billableFiltered) {
          //   console.log('Filtered out entry:', {
          //     id: entry?.fieldData?.__ID,
          //     date: entry?.fieldData?.DateStart,
          //     dateFiltered,
          //     billableFiltered,
          //     dnb: entry?.fieldData?.f_dnb,
          //     omit: entry?.fieldData?.f_omit
          //   });
          // }
          return dateFiltered && billableFiltered;
        } catch (error) {
          console.error('Error filtering entry:', error);
          return false;
        }
      });
      console.log(`Filtered to ${filtered.length} records`);
      return filtered;
    };
  }, []);

  const aggregateHrsData = useMemo(() => {
    return (data, filter) => {
      try {
        const filteredData = filterByDate(data, filter);
        const result = {
          byGroup: {},
          totalHours: 0,
        };
    
        filteredData.forEach((entry) => {
          if (!entry?.fieldData) return;
          
          const { 
            "customers_Projects::projectName": projectName,
            "Customers::Name": customerName,
            Billable_Time_Rounded: billableTime
          } = entry.fieldData;
          
          const groupKey = filter === "Today" 
            ? (projectName || "Unspecified Project")
            : (customerName || "Unknown Customer");
            
          const hours = Number(billableTime || 0);
          // console.log('Processing entry:', {
          //   projectName,
          //   customerName,
          //   billableTime,
          //   hours,
          //   groupKey,
          //   DateStart: entry.fieldData.DateStart
          // });
          
          result.byGroup[groupKey] = (result.byGroup[groupKey] || 0) + hours;
          result.totalHours += hours;
        });

        return {
          data: result.byGroup,
          title: `Total Hours: ${result.totalHours.toFixed(2)}`
        };
      } catch (error) {
        return {
          data: {},
          title: "Total Hours: 0.00"
        };
      }
    };
  }, [filterByDate]);

  const aggregateBillablesData = useMemo(() => {
    return (data, filter, customer) => {
      try {
        let filteredData = filterByDate(data, filter);
    
        if (customer !== "All") {
          filteredData = filteredData.filter(
            (entry) => entry?.fieldData?.["customers_Projects::_custID"] === customer
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
            if (!entry?.fieldData?.DateStart) return;
            
            const date = getLocalDate(entry.fieldData.DateStart);
            const weekKey = getWeekKey(date);
            
            if (weekKey in aggregated) {
              const hours = Number(entry.fieldData.Billable_Time_Rounded || 0);
              const rate = Number(entry.fieldData["Customers::chargeRate"] || 0);
              const total = convertToCAD(hours * rate, entry);
              aggregated[weekKey] += total;
            }
          });
        } else {
          // Monthly aggregation
          filteredData.forEach((entry) => {
            if (!entry?.fieldData?.DateStart) return;
            
            const date = getLocalDate(entry.fieldData.DateStart);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const hours = Number(entry.fieldData.Billable_Time_Rounded || 0);
            const rate = Number(entry.fieldData["Customers::chargeRate"] || 0);
            const total = convertToCAD(hours * rate, entry);
            aggregated[key] = (aggregated[key] || 0) + total;
          });

          // Calculate projection for current month
          const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (currentMonthKey in aggregated) {
            // Get last 14 days of data
            const fourteenDaysAgo = new Date(today);
            fourteenDaysAgo.setDate(today.getDate() - 14);
            
            const last14DaysData = filteredData.filter(entry => {
              const entryDate = getLocalDate(entry.fieldData.DateStart);
              return entryDate >= fourteenDaysAgo && entryDate <= today;
            });

            // Calculate average daily earnings for last 14 days
            const last14DaysTotal = last14DaysData.reduce((sum, entry) => {
              const hours = Number(entry.fieldData.Billable_Time_Rounded || 0);
              const rate = Number(entry.fieldData["Customers::chargeRate"] || 0);
              return sum + convertToCAD(hours * rate, entry);
            }, 0);
            const avgDailyEarnings = last14DaysTotal / 14;

            // Calculate remaining days in month
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const remainingDays = lastDayOfMonth.getDate() - today.getDate();

            // Project earnings for remaining days
            const projectedAdditional = avgDailyEarnings * remainingDays;
            aggregated[currentMonthKey] += projectedAdditional;
          }
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
  }, [filterByDate]);

  const hrsData = useMemo(() => {
    const data = aggregateHrsData(billables, hrsFilter);
    console.log('Final hours data for Charts:', {
      filter: hrsFilter,
      data: data.data,
      title: data.title
    });
    return data;
  }, [billables, hrsFilter, aggregateHrsData]);

  const billablesData = useMemo(() => {
    return aggregateBillablesData(billables, billablesFilter, selectedCustomer);
  }, [billables, billablesFilter, selectedCustomer, aggregateBillablesData]);

  // Memoize customer options to prevent unnecessary recalculations
  const customerOptions = useMemo(() => {
    return [...new Set(billables.filter(b => b?.fieldData).map((entry) => entry.fieldData["customers_Projects::_custID"]))].map(
      (custID) => {
        const customerName = billables.find(
          (entry) => entry?.fieldData?.["customers_Projects::_custID"] === custID
        )?.fieldData?.["Customers::Name"] || "Unknown";
        return {
          id: custID,
          name: customerName
        };
      }
    );
  }, [billables]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div id="chart-container" className="p-4 bg-white min-h-screen">
      <div id="header" className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Stats Dashboard</h1>
        <button
          onClick={handleClose}
          className="px-2 py-2 bg-white text-gray-700 rounded-full hover:bg-gray-100 flex items-center"
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
                onChange={handleHrsFilterChange}
                className="appearance-none border border-gray-300 bg-white px-4 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              >
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
          </div>
          <Charts type="Pie" data={hrsData.data} title={hrsData.title} />
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
                onChange={handleCustomerChange}
                className="appearance-none border border-gray-300 bg-white px-4 py-1 rounded-lg max-w-60 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option>All</option>
                {customerOptions.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
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
                  onChange={handleBillablesFilterChange}
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

export default React.memo(Stats);
