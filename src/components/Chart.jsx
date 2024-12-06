import React from "react";
import { Pie, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Title,
  BarElement
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  BarElement,
  Title
);

const COLORS = [
  "#0891b2", "#36A2EB", "#009688", "#8BC34A", "#FFEB3B",
  "#FFC107", "#FF9800", "#FF5722", "#E91E63", "#9C27B0",
  "#673AB7", "#3F51B5", "#80CBC4", "#B3E5FC", "#AED581",
  "#FFF176", "#FFAB91", "#8E24AA", "#5C6BC0", "#388E3C"
];

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
    if (options.format === 'hours') {
      return isProjected ? `${value.toFixed(1)} hrs (Projected)` : `${value.toFixed(1)} hrs`;
    }
    const formatted = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    
    return isProjected ? `${formatted} (Projected)` : formatted;
  };

  const formatDate = (key) => {
    if (key.includes('W')) {
      return `Week ${key.split('W')[1]}`;
    }
    if (key.includes('-')) {
      const [year, month] = key.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { 
        month: 'short',
        year: 'numeric'
      });
    }
    return key; // Return the key as-is if it's not a date format
  };

  const getPieChartData = () => ({
    labels: Object.keys(data),
    datasets: [{
      data: Object.values(data),
      backgroundColor: COLORS
    }]
  });

  const getBarChartData = () => {
    if (options.stacked) {
      const labels = Object.keys(data);
      const projectNames = Object.keys(data[labels[0]] || {});
      
      return {
        labels: labels.map(formatDate),
        datasets: projectNames.map((project, index) => ({
          label: project,
          data: labels.map(month => data[month][project] || 0),
          backgroundColor: COLORS[index % COLORS.length]
        }))
      };
    } else {
      // Simple bar chart for project hours
      return {
        labels: Object.keys(data),
        datasets: [{
          data: Object.values(data),
          backgroundColor: COLORS,
          label: 'Hours'
        }]
      };
    }
  };

  const getLineChartData = () => ({
    labels: Object.keys(data).map(formatDate),
    datasets: [{
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
    }]
  });

  const getChartData = () => {
    if (type === "Pie") return getPieChartData();
    if (type === "Bar") return getBarChartData();
    return getLineChartData();
  };

  const getLineChartOptions = () => ({
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          title(context) {
            const key = Object.keys(data)[context[0].dataIndex];
            if (key.includes('W')) {
              const monday = getMondayOfWeek(key);
              return `Week ${key.split('W')[1]} (${monday.toLocaleDateString('en-CA')})`;
            }
            return context[0].label;
          },
          label(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
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
          callback: value => options.format === 'hours' 
            ? `${value.toFixed(1)} hrs`
            : new Intl.NumberFormat('en-CA', {
                style: 'currency',
                currency: 'CAD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
        }
      }
    }
  });

  const getBarChartOptions = () => ({
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatLabel(value)}`;
          }
        }
      },
      legend: {
        display: options.stacked
      }
    },
    scales: {
      x: {
        stacked: options.stacked
      },
      y: {
        stacked: options.stacked,
        ticks: {
          callback: value => options.format === 'hours' 
            ? `${value.toFixed(1)} hrs`
            : new Intl.NumberFormat('en-CA', {
                style: 'currency',
                currency: 'CAD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
        }
      }
    }
  });

  const getChartOptions = () => {
    if (type === "Line") return getLineChartOptions();
    if (type === "Bar") return getBarChartOptions();
    return {};
  };

  const chartData = getChartData();
  const chartOptions = getChartOptions();

  return (
    <div className="p-4 bg-gray-50 shadow-md rounded-3xl">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {type === "Pie" ? (
        <Pie data={chartData} />
      ) : type === "Bar" ? (
        <Bar data={chartData} options={chartOptions} />
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
    </div>
  );
};

export default Charts;
