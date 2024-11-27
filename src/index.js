import React, { useEffect, useState } from 'react';
import { createRoot } from "react-dom/client";
import EmailResults from './components/EmailResults';

// Function to fetch data from FileMaker
function getDataFromFileMaker(callback, attempt = 0) {
  console.log("Attempting to connect to FileMaker, attempt:", attempt);
  if (typeof FileMaker !== "undefined" && FileMaker.PerformScript) {
      console.log("FileMaker object found. waking up...");
      const param = {
        action: "getEmailResult"
      }
      FileMaker.PerformScriptWithOption("app*js*callback", JSON.stringify(param), 3);
  } else if (attempt < 10) {
      setTimeout(() => getDataFromFileMaker(callback, attempt + 1), 100);
  } else {
      console.error("Error: FileMaker object is unavailable.");
      callback({ error: true, message: "FileMaker object is unavailable." });
  }
}

// Main App Component
function App() {
    const [emailData, setEmailData] = useState({});

    useEffect(() => {
        // Set up FileMaker callback
        window.fmCallback = (data) => {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                setEmailData(parsedData);
            } catch (error) {
                console.error('Error parsing data:', error);
            }
        };

        getDataFromFileMaker();

        return () => unsubscribe();
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl">
                    <EmailResults data={emailData} />
                </div>
            </div>
        </div>
    );
}

// Render the App to the root element
console.log("emailresults v1.0")
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />)
