import React from "react";
import { Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Title
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Title
);

const Charts = ({ type, data, title, options = {} }) => {
  const isProjection = (key) => {
    if (!options.showProjection) return false;
    const today = new Date();
    
    if (key.includes('W')) {
      const currentWeek = getISOWeek(today);
      const currentWeekKey = `${today.getFullYear()}-W${String(currentWeek).padStart(2, '0')}`;
      return key === currentWeekKey;
    } else {
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      return key === currentMonthKey;
    }
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

  const getMondayOfWeek = (key) => {
    const [year, week] = key.split('-W').map(n => parseInt(n, 10));
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    if (dayOfWeek <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  };

  const formatLabel = (value, isProjected) => {
    const formatted = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    
    return isProjected ? `${formatted} (Projected)` : formatted;
  };

  const chartData =
    type === "Pie"
      ? {
          labels: Object.keys(data),
          datasets: [
            {
              data: Object.values(data),
              backgroundColor: [
                "#0891b2", "#36A2EB", "#009688", "#8BC34A", "#FFEB3B",
                "#FFC107", "#FF9800", "#FF5722", "#E91E63", "#9C27B0",
                "#673AB7", "#3F51B5", "#80CBC4", "#B3E5FC", "#AED581",
                "#FFF176", "#FFAB91", "#8E24AA", "#5C6BC0", "#388E3C"
              ]
            }
          ]
        }
      : {
          labels: Object.keys(data).map(key => {
            if (key.includes('W')) {
              return `Week ${key.split('W')[1]}`; // Just show "Week XX"
            }
            // Format month labels: "MMM YYYY"
            const [year, month] = key.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { 
              month: 'short',
              year: 'numeric'
            });
          }),
          datasets: [
            {
              label: title,
              data: Object.values(data),
              borderColor: "#36A2EB",
              backgroundColor: Object.keys(data).map(key => 
                isProjection(key) ? "rgba(255, 99, 132, 0.5)" : "rgba(54, 162, 235, 0.5)"
              ),
              borderDash: Object.keys(data).map(key => 
                isProjection(key) ? [5, 5] : []
              ),
              tension: 0.4
            }
          ]
        };

  const chartOptions = type === "Line" ? {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context) {
            const key = Object.keys(data)[context[0].dataIndex];
            if (key.includes('W')) {
              const monday = getMondayOfWeek(key);
              return `Week ${key.split('W')[1]} (${monday.toLocaleDateString('en-CA')})`;
            }
            return context[0].label;
          },
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              const value = context.parsed.y;
              const isProjected = isProjection(Object.keys(data)[context.dataIndex]);
              label += formatLabel(value, isProjected);
            }
            return label;
          }
        }
      },
      legend: {
        display: true
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: 'CAD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(value);
          }
        }
      }
    }
  } : {};

  return (
    <div className="p-4 bg-gray-50 shadow-md rounded-3xl">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {type === "Pie" ? (
        <Pie data={chartData} />
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
    </div>
  );
};

export default Charts;
