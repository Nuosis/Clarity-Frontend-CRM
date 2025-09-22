/**
 * DocumentationFileList component
 * Displays a file browser for GitHub repository documentation
 * Following DEVELOPMENT_GUIDELINES.md patterns for React components
 */

import React, { useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { useTheme } from '../layout/AppLayout'
import {
  fetchRepositoryContents,
  selectContents,
  selectContentsLoading,
  selectContentsError,
  selectCurrentPath,
  setCurrentPath,
  clearContentsError
} from '../../store/slices/documentationSlice'

const FileListContainer = styled.div`
  border: 1px solid ${props => props.$darkMode ? '#30363d' : '#e1e5e9'};
  border-radius: 6px;
  background: ${props => props.$darkMode ? '#0d1117' : '#ffffff'};
  max-width: 250px;
  max-height: 600px;
  overflow-y: auto;
  min-width: 200px;
`

const FileListHeader = styled.div`
  padding: 12px 16px;
  background: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
  border-bottom: 1px solid ${props => props.$darkMode ? '#30363d' : '#e1e5e9'};
  font-weight: 600;
  color: ${props => props.$darkMode ? '#f0f6fc' : '#24292f'};
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const PathBreadcrumb = styled.div`
  font-size: 12px;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
`

const BreadcrumbSegment = styled.button`
  background: none;
  border: none;
  color: ${props => props.$darkMode ? '#58a6ff' : '#0969da'};
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.15s ease;

  &:hover {
    background: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
  }

  &:last-child {
    color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
    cursor: default;
    
    &:hover {
      background: none;
    }
  }
`

const BreadcrumbSeparator = styled.span`
  color: ${props => props.$darkMode ? '#6e7681' : '#8c959f'};
  font-size: 10px;
`

const FileItem = styled.div`
  padding: 8px 16px;
  border-bottom: 1px solid ${props => props.$darkMode ? '#21262d' : '#f0f3f6'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.15s ease;

  &:hover {
    background: ${props => props.$darkMode ? '#161b22' : '#f6f8fa'};
  }

  &:last-child {
    border-bottom: none;
  }
`

const FileIcon = styled.span`
  font-size: 16px;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  width: 16px;
  text-align: center;
`

const FileName = styled.span.withConfig({
  shouldForwardProp: (prop) => !prop.startsWith('$')
})`
  color: ${props => props.$darkMode ? '#58a6ff' : '#0969da'};
  font-size: 14px;
  flex: 1;

  ${props => props.$isDirectory && `
    font-weight: 500;
  `}
`

const LoadingState = styled.div`
  padding: 24px;
  text-align: center;
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
  padding: 24px;
  text-align: center;
  color: ${props => props.$darkMode ? '#8b949e' : '#656d76'};
  font-size: 14px;
`


/**
 * DocumentationFileList component for browsing repository files
 * @param {Object} props - Component props
 * @param {string} props.owner - GitHub repository owner
 * @param {string} props.repo - GitHub repository name
 * @param {string} [props.gitRef] - Git reference (branch, tag, commit)
 * @param {Function} props.onFileSelect - Callback when file is selected
 * @param {Function} [props.onDirectoryChange] - Callback when directory changes
 */
const DocumentationFileList = ({
  owner,
  repo,
  gitRef,
  onFileSelect,
  onDirectoryChange
}) => {
  const dispatch = useDispatch()
  const { darkMode } = useTheme()
  
  const contents = useSelector(selectContents)
  const loading = useSelector(selectContentsLoading)
  const error = useSelector(selectContentsError)
  const currentPath = useSelector(selectCurrentPath)

  // Get current directory contents with filtering for hidden/system files
  const currentContents = useMemo(() => {
    const pathContents = contents[currentPath]
    
    // Ensure we always return an array
    if (!pathContents) {
      return []
    }
    
    let rawContents = []
    
    // Handle different response structures - API might return { contents: Array } or Array directly
    if (Array.isArray(pathContents)) {
      rawContents = pathContents
    } else if (pathContents && typeof pathContents === 'object' && Array.isArray(pathContents.contents)) {
      // Handle case where response is an object with contents property
      rawContents = pathContents.contents
    } else {
      // Handle case where contents is not an array or expected structure
      console.warn('Repository contents is not an array for path:', currentPath, pathContents)
      return []
    }
    
    // Filter out system/hidden files
    return rawContents.filter(item => {
      const name = item.name
      // Hide common system files and hidden files
      const hiddenPatterns = [
        '.DS_Store',        // macOS system file
        '.git',             // Git directory
        '.gitignore',       // Git ignore file (keep this one visible)
        'Thumbs.db',        // Windows thumbnail cache
        '.env.local',       // Local environment files
        '.env.development', // Development environment files
        '.env.production',  // Production environment files
        'node_modules',     // Node.js dependencies
        '.next',            // Next.js build directory
        '.nuxt',            // Nuxt.js build directory
        'dist',             // Build output directory
        'build'             // Build output directory
      ]
      
      // Don't hide .gitignore as it's useful for documentation
      if (name === '.gitignore') {
        return true
      }
      
      // Hide files that start with . (except .gitignore)
      if (name.startsWith('.')) {
        return false
      }
      
      // Hide specific system files and directories
      return !hiddenPatterns.includes(name)
    })
  }, [contents, currentPath])

  // Load initial directory contents
  useEffect(() => {
    if (owner && repo) {
      dispatch(fetchRepositoryContents({ 
        owner, 
        repo, 
        path: currentPath,
        ref: gitRef
      }))
    }
  }, [dispatch, owner, repo, currentPath, gitRef])

  // Handle file/directory click
  const handleItemClick = useCallback((item) => {
    if (item.type === 'dir') {
      const newPath = currentPath ? `${currentPath}/${item.name}` : item.name
      dispatch(setCurrentPath(newPath))
      onDirectoryChange?.(newPath)
    } else if (item.type === 'file') {
      const filePath = currentPath ? `${currentPath}/${item.name}` : item.name
      onFileSelect(filePath, item)
    }
  }, [currentPath, dispatch, onFileSelect, onDirectoryChange])

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback((targetPath) => {
    dispatch(setCurrentPath(targetPath))
    onDirectoryChange?.(targetPath)
  }, [dispatch, onDirectoryChange])

  // Generate breadcrumb segments
  const breadcrumbSegments = useMemo(() => {
    if (!currentPath) return []
    
    const pathParts = currentPath.split('/')
    const segments = []
    
    // Find the ai_docs index and start from there
    const aiDocsIndex = pathParts.findIndex(part => part === 'ai_docs')
    const relevantParts = aiDocsIndex >= 0 ? pathParts.slice(aiDocsIndex) : pathParts
    
    // Add path segments starting from ai_docs
    let currentSegmentPath = ''
    const fullPathParts = currentPath.split('/')
    
    relevantParts.forEach((part, index) => {
      // Calculate the full path up to this segment
      const fullIndex = aiDocsIndex >= 0 ? aiDocsIndex + index : index
      currentSegmentPath = fullPathParts.slice(0, fullIndex + 1).join('/')
      segments.push({ name: part, path: currentSegmentPath })
    })
    
    return segments
  }, [currentPath])

  // Clear error when component unmounts or props change
  useEffect(() => {
    return () => {
      if (error) {
        dispatch(clearContentsError())
      }
    }
  }, [dispatch, error])

  // Get file icon based on type and name
  const getFileIcon = useCallback((item) => {
    if (item.type === 'dir') {
      return '📁'
    }
    
    const extension = item.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'md':
        return '📄'
      case 'txt':
        return '📝'
      case 'json':
        return '⚙️'
      case 'js':
      case 'jsx':
        return '📜'
      case 'ts':
      case 'tsx':
        return '📘'
      default:
        return '📄'
    }
  }, [])

  if (loading) {
    return (
      <FileListContainer $darkMode={darkMode}>
        <LoadingState $darkMode={darkMode}>Loading files...</LoadingState>
      </FileListContainer>
    )
  }

  if (error) {
    return (
      <ErrorState $darkMode={darkMode}>
        Error loading files: {error}
      </ErrorState>
    )
  }

  return (
    <FileListContainer $darkMode={darkMode}>
      {breadcrumbSegments.length > 0 && (
        <FileListHeader $darkMode={darkMode}>
          <div>
            <PathBreadcrumb $darkMode={darkMode}>
              {breadcrumbSegments.map((segment, index) => (
                <React.Fragment key={segment.path}>
                  {index > 0 && <BreadcrumbSeparator $darkMode={darkMode}>›</BreadcrumbSeparator>}
                  <BreadcrumbSegment
                    $darkMode={darkMode}
                    onClick={() => index < breadcrumbSegments.length - 1 ? handleBreadcrumbClick(segment.path) : null}
                    disabled={index === breadcrumbSegments.length - 1}
                  >
                    {segment.name}
                  </BreadcrumbSegment>
                </React.Fragment>
              ))}
            </PathBreadcrumb>
          </div>
        </FileListHeader>
      )}
      
      {currentContents.length === 0 ? (
        <EmptyState $darkMode={darkMode}>No files found in this directory</EmptyState>
      ) : (
        currentContents.map((item) => (
          <FileItem
            key={item.name}
            $darkMode={darkMode}
            onClick={() => handleItemClick(item)}
          >
            <FileIcon $darkMode={darkMode}>{getFileIcon(item)}</FileIcon>
            <FileName $darkMode={darkMode} $isDirectory={item.type === 'dir'}>
              {item.name}
            </FileName>
          </FileItem>
        ))
      )}
    </FileListContainer>
  )
}

DocumentationFileList.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  gitRef: PropTypes.string,
  onFileSelect: PropTypes.func.isRequired,
  onDirectoryChange: PropTypes.func
}

export default DocumentationFileList