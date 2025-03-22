#!/usr/bin/env node
import { rollup } from 'rollup';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import the rollup config
import config from '../rollup.docs.config.js';

async function build() {
  console.log('Building documentation bundle...');
  
  // Ensure docs directory exists
  if (!fs.existsSync(path.join(projectRoot, 'docs'))) {
    fs.mkdirSync(path.join(projectRoot, 'docs'));
  }
  
  try {
    // Create the bundle
    const bundle = await rollup(config);
    await bundle.write(config.output);
    
    // Generate HTML viewer
    const bundlePath = path.join(projectRoot, 'docs', 'project-bundle.js');
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clarity CRM Frontend - Project Documentation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      border-bottom: 1px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    h2 {
      font-size: 1.8em;
      margin-top: 30px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow: auto;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      line-height: 1.45;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
      background-color: #f5f5f5;
      padding: 2px 5px;
      border-radius: 3px;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid #ddd;
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border: 1px solid transparent;
      border-bottom: none;
    }
    .tab.active {
      background-color: #f5f5f5;
      border-color: #ddd;
      border-radius: 5px 5px 0 0;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .line-numbers {
      counter-reset: line;
      padding-left: 3em;
      position: relative;
    }
    .line-numbers > span {
      counter-increment: line;
      display: block;
      position: relative;
    }
    .line-numbers > span:before {
      content: counter(line);
      position: absolute;
      left: -3em;
      width: 2.5em;
      text-align: right;
      color: #999;
      padding-right: 0.5em;
      border-right: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <header>
    <h1>Clarity CRM Frontend - Project Documentation</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    <p>This document provides a comprehensive view of the entire project codebase for documentation and review purposes.</p>
  </header>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('bundle')">Bundle View</div>
    <div class="tab" onclick="switchTab('stats')">Bundle Stats</div>
  </div>

  <div id="bundle" class="tab-content active">
    <h2>Complete Project Bundle</h2>
    <p>This is a non-minified representation of the entire project, including all source files and their dependencies.</p>
    <pre><code class="line-numbers">${bundleContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\n')
      .map(line => `<span>${line}</span>`)
      .join('\n')}</code></pre>
  </div>

  <div id="stats" class="tab-content">
    <h2>Bundle Statistics</h2>
    <p>For a visual representation of the bundle size and module relationships, <a href="bundle-stats.html" target="_blank">click here</a>.</p>
  </div>

  <script>
    function switchTab(tabId) {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Deactivate all tabs
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Activate the selected tab and content
      document.getElementById(tabId).classList.add('active');
      document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`).classList.add('active');
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(projectRoot, 'docs', 'project-documentation.html'), htmlContent);
    
    console.log('Documentation bundle generated successfully!');
    console.log(`- Bundle file: ${path.join('docs', 'project-bundle.js')}`);
    console.log(`- HTML viewer: ${path.join('docs', 'project-documentation.html')}`);
    console.log(`- Bundle stats: ${path.join('docs', 'bundle-stats.html')}`);
  } catch (error) {
    console.error('Error generating documentation bundle:', error);
    process.exit(1);
  }
}

build();