/**
 * DocumentationViewer component
 * Renders markdown content from GitHub repository files
 * Following DEVELOPMENT_GUIDELINES.md patterns for React components
 */

import { useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '../layout/AppLayout'
import {
  fetchFileContent,
  selectFiles,
  selectFileLoading,
  selectFileError,
  selectSelectedFile,
  clearFileError
} from '../../store/slices/documentationSlice'

const ViewerContainer = styled.div`
  border: 1px solid ${props => props.$darkMode ? '#30363d' : '#e1e5e9'};
  border-radius: 6px;
  background: ${props => props.$darkMode ? '#0d1117' : '#ffffff'};
  height: 600px;
  display: flex;
  flex-direction: column;
`

const ViewerHeader = styled.div`
  padding: 12px 16px;
  background: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
  border-bottom: 1px solid ${props => props.$darkMode ? '#30363d' : '#e1e5e9'};
  font-weight: 600;
  color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`

const FileName = styled.span`
  font-size: 14px;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  font-weight: normal;
`

const ViewerContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: ${props => props.$darkMode ? '#0d1117' : '#ffffff'};
`

const MarkdownContent = styled.div`
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};

  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
    color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  }

  h1 {
    font-size: 2em;
    border-bottom: 1px solid ${props => props.$darkMode ? '#30363d' : '#d0d7de'};
    padding-bottom: 0.3em;
  }

  h2 {
    font-size: 1.5em;
    border-bottom: 1px solid ${props => props.$darkMode ? '#30363d' : '#d0d7de'};
    padding-bottom: 0.3em;
  }

  h3 {
    font-size: 1.25em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.875em;
  }

  h6 {
    font-size: 0.85em;
    color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  }

  /* Paragraphs */
  p {
    margin-top: 0;
    margin-bottom: 16px;
  }

  /* Lists */
  ul, ol {
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 2em;
  }

  li {
    margin-bottom: 0.25em;
  }

  li > p {
    margin-bottom: 0.5em;
  }

  /* Code */
  code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: ${props => props.$darkMode ? 'rgba(110, 118, 129, 0.4)' : 'rgba(175, 184, 193, 0.2)'};
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  }

  pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
    border-radius: 6px;
    margin-bottom: 16px;
    border: 1px solid ${props => props.$darkMode ? '#30363d' : 'transparent'};
  }

  pre code {
    display: inline;
    max-width: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    line-height: inherit;
    word-wrap: normal;
    background-color: transparent;
    border: 0;
    color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  }

  /* Links */
  a {
    color: ${props => props.$darkMode ? '#58a6ff' : '#0969da'};
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  /* Blockquotes */
  blockquote {
    padding: 0 1em;
    color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
    border-left: 0.25em solid ${props => props.$darkMode ? '#30363d' : '#d0d7de'};
    margin: 0 0 16px 0;
  }

  blockquote > :first-child {
    margin-top: 0;
  }

  blockquote > :last-child {
    margin-bottom: 0;
  }

  /* Tables */
  table {
    border-spacing: 0;
    border-collapse: collapse;
    margin-bottom: 16px;
    width: 100%;
  }

  table th,
  table td {
    padding: 6px 13px;
    border: 1px solid ${props => props.$darkMode ? '#30363d' : '#d0d7de'};
    color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  }

  table th {
    font-weight: 600;
    background-color: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
  }

  table tr:nth-child(2n) {
    background-color: ${props => props.$darkMode ? '#0d1117' : '#f6f8fa'};
  }

  /* Horizontal rules */
  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: ${props => props.$darkMode ? '#30363d' : '#d0d7de'};
    border: 0;
  }

  /* Images */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 16px 0;
  }

  /* Task lists */
  input[type="checkbox"] {
    margin-right: 0.5em;
  }
`

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  font-size: 14px;
`

const ErrorState = styled.div`
  padding: 16px;
  background: ${props => props.$darkMode ? '#1a1e23' : '#fff8f8'};
  border: 1px solid ${props => props.$darkMode ? '#da3633' : '#f85149'};
  border-radius: 6px;
  margin: 16px;
  color: ${props => props.$darkMode ? '#f85149' : '#d1242f'};
  font-size: 14px;
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  font-size: 14px;
  text-align: center;
  flex-direction: column;
  gap: 8px;
`

const RefreshButton = styled.button`
  background: ${props => props.$darkMode ? '#238636' : '#0969da'};
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: ${props => props.$darkMode ? '#2ea043' : '#0860ca'};
  }
`

/**
 * DocumentationViewer component for rendering markdown files
 * @param {Object} props - Component props
 * @param {string} props.owner - GitHub repository owner
 * @param {string} props.repo - GitHub repository name
 * @param {string} props.filePath - Path to the file to display
 * @param {string} [props.gitRef] - Git reference (branch, tag, commit)
 */
const DocumentationViewer = ({ owner, repo, filePath, gitRef }) => {
  const dispatch = useDispatch()
  const { darkMode } = useTheme()
  
  const files = useSelector(selectFiles)
  const loading = useSelector(selectFileLoading)
  const error = useSelector(selectFileError)
  const selectedFile = useSelector(selectSelectedFile)

  // Get current file content
  const fileContent = useMemo(() => {
    if (!filePath || !files[filePath]) return null
    return files[filePath]
  }, [files, filePath])

  // Load file content when filePath changes
  useEffect(() => {
    if (owner && repo && filePath) {
      dispatch(fetchFileContent({ 
        owner, 
        repo, 
        path: filePath,
        ref: gitRef
      }))
    }
  }, [dispatch, owner, repo, filePath, gitRef])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (owner && repo && filePath) {
      dispatch(fetchFileContent({ 
        owner, 
        repo, 
        path: filePath,
        ref: gitRef
      }))
    }
  }, [dispatch, owner, repo, filePath, gitRef])

  // Clear error when component unmounts or props change
  useEffect(() => {
    return () => {
      if (error) {
        dispatch(clearFileError())
      }
    }
  }, [dispatch, error])

  // Get file name from path
  const fileName = useMemo(() => {
    if (!filePath) return ''
    return filePath.split('/').pop()
  }, [filePath])

  // Decode base64 content if needed
  const decodedContent = useMemo(() => {
    if (!fileContent?.content) return ''
    
    // If content is base64 encoded, decode it
    if (fileContent.encoding === 'base64') {
      try {
        return atob(fileContent.content)
      } catch (e) {
        console.error('Failed to decode base64 content:', e)
        return fileContent.content
      }
    }
    
    return fileContent.content
  }, [fileContent])

  // Check if file is markdown
  const isMarkdown = useMemo(() => {
    if (!fileName) return false
    const extension = fileName.split('.').pop()?.toLowerCase()
    return ['md', 'markdown'].includes(extension)
  }, [fileName])

  if (loading) {
    return (
      <ViewerContainer $darkMode={darkMode}>
        <ViewerHeader $darkMode={darkMode}>
          Documentation Viewer
          {fileName && <FileName $darkMode={darkMode}>{fileName}</FileName>}
        </ViewerHeader>
        <LoadingState $darkMode={darkMode}>Loading file content...</LoadingState>
      </ViewerContainer>
    )
  }

  if (error) {
    return (
      <ViewerContainer $darkMode={darkMode}>
        <ViewerHeader $darkMode={darkMode}>
          Documentation Viewer
          {fileName && <FileName $darkMode={darkMode}>{fileName}</FileName>}
        </ViewerHeader>
        <ViewerContent $darkMode={darkMode}>
          <ErrorState $darkMode={darkMode}>
            Error loading file: {error}
          </ErrorState>
        </ViewerContent>
      </ViewerContainer>
    )
  }

  if (!filePath) {
    return (
      <ViewerContainer $darkMode={darkMode}>
        <ViewerHeader $darkMode={darkMode}>Documentation Viewer</ViewerHeader>
        <EmptyState $darkMode={darkMode}>
          <div>📄</div>
          <div>Select a file to view its contents</div>
        </EmptyState>
      </ViewerContainer>
    )
  }

  if (!fileContent) {
    return (
      <ViewerContainer $darkMode={darkMode}>
        <ViewerHeader $darkMode={darkMode}>
          Documentation Viewer
          {fileName && <FileName $darkMode={darkMode}>{fileName}</FileName>}
        </ViewerHeader>
        <EmptyState $darkMode={darkMode}>
          <div>📄</div>
          <div>File content not available</div>
          <RefreshButton $darkMode={darkMode} onClick={handleRefresh}>
            Refresh
          </RefreshButton>
        </EmptyState>
      </ViewerContainer>
    )
  }

  return (
    <ViewerContainer $darkMode={darkMode}>
      <ViewerHeader $darkMode={darkMode}>
        Documentation Viewer
        {fileName && <FileName $darkMode={darkMode}>{fileName}</FileName>}
      </ViewerHeader>
      <ViewerContent $darkMode={darkMode}>
        {isMarkdown ? (
          <MarkdownContent $darkMode={darkMode}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {decodedContent}
            </ReactMarkdown>
          </MarkdownContent>
        ) : (
          <pre style={{
            margin: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '14px',
            lineHeight: '1.45',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: darkMode ? '#f0f6fc' : '#24292f',
            background: darkMode ? '#0d1117' : '#ffffff'
          }}>
            {decodedContent}
          </pre>
        )}
      </ViewerContent>
    </ViewerContainer>
  )
}

DocumentationViewer.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  filePath: PropTypes.string,
  gitRef: PropTypes.string
}

export default DocumentationViewer