#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// File extensions to include
const INCLUDE_EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.json', '.md'];
// Directories to exclude
const EXCLUDE_DIRS = ['node_modules', 'dist', 'build', '.git'];
// Files to exclude
const EXCLUDE_FILES = ['.DS_Store', 'package-lock.json'];

/**
 * Get syntax highlighting language based on file extension
 */
function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.css':
      return 'css';
    case '.html':
      return 'html';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

/**
 * Recursively get all files from a directory
 */
function getAllFiles(dir, fileList = [], basePath = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const relativePath = path.join(basePath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        fileList = getAllFiles(filePath, fileList, relativePath);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (
        INCLUDE_EXTENSIONS.includes(ext) && 
        !EXCLUDE_FILES.includes(file)
      ) {
        fileList.push({
          path: filePath,
          relativePath: relativePath,
          extension: ext,
          language: getLanguage(filePath)
        });
      }
    }
  });
  
  return fileList;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate file tree HTML
 */
function generateFileTree(files) {
  // Group files by directory
  const fileTree = {};
  
  files.forEach(file => {
    const parts = file.relativePath.split(path.sep);
    let current = fileTree;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    const fileName = parts[parts.length - 1];
    current[fileName] = file;
  });
  
  // Generate HTML
  function renderTree(tree, indent = 0) {
    let html = '';
    const indentStr = '  '.repeat(indent);
    
    Object.keys(tree).sort((a, b) => {
      // Directories first, then files
      const aIsDir = typeof tree[a] !== 'object' || !tree[a].path;
      const bIsDir = typeof tree[b] !== 'object' || !tree[b].path;
      
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    }).forEach(key => {
      const item = tree[key];
      
      if (typeof item !== 'object' || !item.path) {
        // Directory
        html += `${indentStr}<details class="directory">
${indentStr}  <summary>${key}/</summary>
${renderTree(item, indent + 1)}
${indentStr}</details>
`;
      } else {
        // File
        const fileId = item.relativePath.replace(/[^a-zA-Z0-9]/g, '_');
        html += `${indentStr}<div class="file">
${indentStr}  <a href="#${fileId}" class="file-link">${key}</a>
${indentStr}</div>
`;
      }
    });
    
    return html;
  }
  
  return renderTree(fileTree);
}

/**
 * Generate file content HTML
 */
function generateFileContent(files) {
  let html = '';
  
  files.forEach(file => {
    const fileId = file.relativePath.replace(/[^a-zA-Z0-9]/g, '_');
    const content = fs.readFileSync(file.path, 'utf-8');
    
    html += `<div id="${fileId}" class="file-content">
  <h3>${file.relativePath}</h3>
  <pre><code class="language-${file.language}">${escapeHtml(content)}</code></pre>
</div>
`;
  });
  
  return html;
}

/**
 * Main function to generate documentation
 */
async function generateDocumentation() {
  console.log('Generating project documentation...');
  
  // Ensure docs directory exists
  const docsDir = path.join(projectRoot, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
  }
  
  // Get all files
  const files = getAllFiles(path.join(projectRoot, 'src'));
  
  // Add important root files
  ['package.json', 'vite.config.js', 'tailwind.config.js'].forEach(filename => {
    const filePath = path.join(projectRoot, filename);
    if (fs.existsSync(filePath)) {
      files.push({
        path: filePath,
        relativePath: filename,
        extension: path.extname(filename),
        language: getLanguage(filePath)
      });
    }
  });
  
  // Sort files by path
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  
  // Generate HTML
  const fileTree = generateFileTree(files);
  const fileContent = generateFileContent(files);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clarity CRM Frontend - Project Documentation</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/css.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/xml.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/markdown.min.js"></script>
  <style>
    :root {
      --sidebar-width: 300px;
      --header-height: 60px;
      --primary-color: #3498db;
      --secondary-color: #2c3e50;
      --bg-color: #f8f9fa;
      --text-color: #333;
      --border-color: #ddd;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
    }
    
    header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--header-height);
      background-color: var(--secondary-color);
      color: white;
      display: flex;
      align-items: center;
      padding: 0 20px;
      z-index: 100;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    header h1 {
      font-size: 1.5rem;
      margin-right: 20px;
    }
    
    header .meta {
      font-size: 0.9rem;
      opacity: 0.8;
    }
    
    .container {
      display: flex;
      margin-top: var(--header-height);
      height: calc(100vh - var(--header-height));
    }
    
    .sidebar {
      width: var(--sidebar-width);
      height: 100%;
      overflow-y: auto;
      background-color: white;
      border-right: 1px solid var(--border-color);
      padding: 20px;
      position: fixed;
      left: 0;
      top: var(--header-height);
    }
    
    .content {
      flex: 1;
      padding: 20px;
      margin-left: var(--sidebar-width);
      overflow-y: auto;
    }
    
    .directory summary {
      cursor: pointer;
      padding: 5px 0;
      font-weight: bold;
      color: var(--secondary-color);
    }
    
    .file {
      padding: 5px 0 5px 20px;
    }
    
    .file-link {
      color: var(--text-color);
      text-decoration: none;
    }
    
    .file-link:hover {
      color: var(--primary-color);
      text-decoration: underline;
    }
    
    .file-content {
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .file-content h3 {
      margin-bottom: 10px;
      padding: 10px;
      background-color: var(--secondary-color);
      color: white;
      border-radius: 5px 5px 0 0;
    }
    
    pre {
      margin: 0;
      border-radius: 0 0 5px 5px;
      overflow: auto;
    }
    
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      line-height: 1.45;
    }
    
    .search-container {
      margin-bottom: 20px;
    }
    
    #search {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }
    
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: var(--primary-color);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      opacity: 0.7;
      transition: opacity 0.3s;
    }
    
    .back-to-top:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <header>
    <h1>Clarity CRM Frontend</h1>
    <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
  </header>
  
  <div class="container">
    <div class="sidebar">
      <div class="search-container">
        <input type="text" id="search" placeholder="Search files...">
      </div>
      <div class="file-tree">
${fileTree}
      </div>
    </div>
    
    <div class="content">
${fileContent}
    </div>
  </div>
  
  <a href="#" class="back-to-top" title="Back to top">↑</a>
  
  <script>
    // Initialize syntax highlighting
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const fileLinks = document.querySelectorAll('.file-link');
      
      fileLinks.forEach(link => {
        const fileName = link.textContent.toLowerCase();
        const fileItem = link.closest('.file');
        
        if (fileName.includes(searchTerm)) {
          fileItem.style.display = 'block';
          
          // Expand parent directories
          let parent = fileItem.parentElement;
          while (parent) {
            if (parent.tagName === 'DETAILS') {
              parent.open = true;
            }
            parent = parent.parentElement;
          }
        } else {
          fileItem.style.display = 'none';
        }
      });
    });
  </script>
</body>
</html>`;
  
  // Write HTML to file
  fs.writeFileSync(path.join(docsDir, 'project-documentation.html'), html);
  
  console.log('Documentation generated successfully!');
  console.log(`- HTML documentation: ${path.join('docs', 'project-documentation.html')}`);
}

generateDocumentation().catch(err => {
  console.error('Error generating documentation:', err);
  process.exit(1);
});