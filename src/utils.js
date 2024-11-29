function transformJsonForAccordionMenu(json) {
  if (!json?.response?.data) {
      console.error("Invalid JSON structure");
      return [];
  }

  // Group projects by customer
  const groupedData = json.response.data.reduce((acc, item) => {
      const fieldData = item.fieldData;

      const customerName = fieldData["Customers::Name"];
      const customerId = fieldData["_custID"];
      const projectName = fieldData.projectName;
      const projectStatus = fieldData.status;
      const projectId = fieldData.__ID;

      if (!customerName || !customerId) {
          console.warn("Missing customer name or ID in item:", item);
          return acc;
      }

      // Check if customer already exists in the group
      if (!acc[customerId]) {
          acc[customerId] = {
              name: customerName,
              id: customerId,
              submenu: [] // Initialize empty submenu
          };
      }

      // Add the project to the submenu and sort it by project name
      const projectItem = {
          name: projectName, // Render only project name
          status: projectStatus, // Retain project status
          id: projectId // Retain project ID
      };

      acc[customerId].submenu.push(projectItem);

      return acc;
  }, {});

  Object.keys(groupedData).forEach((customerId) => {
    groupedData[customerId].submenu.sort((a, b) => a.name.localeCompare(b.name));
  });

  // Convert grouped data into an array and sort by customer name
  const sortedGroupedData = Object.values(groupedData).sort((a, b) => a.name.localeCompare(b.name));
  return sortedGroupedData;
}

export { transformJsonForAccordionMenu };