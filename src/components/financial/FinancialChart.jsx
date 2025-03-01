import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
);

/**
 * Financial chart component for displaying financial data
 * @param {Object} props - Component props
 * @param {Object} props.data - Chart data
 * @param {string} props.timeframe - Current timeframe
 * @param {function} props.onMonthClick - Function to call when a month is clicked on the line chart
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @returns {JSX.Element} Financial chart component
 */
function FinancialChart({ data, timeframe, onMonthClick, darkMode }) {
  const isLineChart = timeframe === 'thisQuarter' || timeframe === 'thisYear';
  
  // Set chart colors based on theme
  const textColor = darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  const gridColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  
  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: darkMode ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        bodyColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor
        }
      },
      y: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor,
          callback: function(value) {
            return new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              maximumFractionDigits: 0
            }).format(value);
          }
        }
      }
    },
    // For stacked bar charts
    ...(isLineChart ? {} : {
      scales: {
        x: {
          stacked: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          stacked: true,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            callback: function(value) {
              return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                maximumFractionDigits: 0
              }).format(value);
            }
          }
        }
      }
    })
  };

  // Handle click on line chart
  const handleChartClick = (event, elements) => {
    if (elements.length > 0 && isLineChart) {
      const index = elements[0].index;
      const monthData = {
        month: data.originalData[index].month,
        year: data.originalData[index].year
      };
      onMonthClick(monthData);
    }
  };

  // If no data is available
  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className={`h-64 flex items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        No financial data available for the selected timeframe
      </div>
    );
  }

  return (
    <div className="h-64">
      {isLineChart ? (
        <Line 
          data={data} 
          options={chartOptions} 
          onClick={handleChartClick}
        />
      ) : (
        <Bar 
          data={data} 
          options={chartOptions} 
        />
      )}
    </div>
  );
}

FinancialChart.propTypes = {
  data: PropTypes.shape({
    labels: PropTypes.array.isRequired,
    datasets: PropTypes.array.isRequired,
    originalData: PropTypes.array
  }).isRequired,
  timeframe: PropTypes.string.isRequired,
  onMonthClick: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

FinancialChart.defaultProps = {
  darkMode: false
};

export default React.memo(FinancialChart);