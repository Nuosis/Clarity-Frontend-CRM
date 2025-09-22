import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import { string } from 'rollup-plugin-string';
import { visualizer } from 'rollup-plugin-visualizer';
import fs from 'fs';
import path from 'path';

// Function to recursively get all JS/JSX files from a directory
function getJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isdirectory() && !filePath.includes('node_modules')) {
      fileList = getJsFiles(filePath, fileList);
    } else if (
      (file.endsWith('.js') || file.endsWith('.jsx')) && 
      !file.includes('.config.js') && 
      !filePath.includes('node_modules')
    ) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Get all JS/JSX files from src directory
const srcFiles = getJsFiles('./src');

export default {
  input: 'src/main.jsx', // Entry point
  output: {
    file: 'docs/project-bundle.js',
    format: 'es',
    sourcemap: true,
    banner: `/**
 * Clarity CRM Frontend - Complete Project Bundle
 * Generated on: ${new Date().toISOString()}
 * 
 * This is a non-minified representation of the entire project for documentation purposes.
 * It includes all source files and their dependencies.
 */

/**
 * Project Structure:
 * ${srcFiles.map(file => ` * - ${file}`).join('\n')}
 */
`,
  },
  plugins: [
    nodeResolve({
      extensions: ['.js', '.jsx'],
    }),
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-react'],
      extensions: ['.js', '.jsx'],
    }),
    commonjs(),
    string({
      include: ['**/*.css', '**/*.svg', '**/*.html'],
    }),
    visualizer({
      filename: 'docs/bundle-stats.html',
      title: 'Clarity CRM Frontend Bundle Analysis',
      open: false,
    }),
  ],
  treeshake: false, // Disable tree-shaking to include all code
  onwarn(warning, warn) {
    // Suppress circular dependency warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};