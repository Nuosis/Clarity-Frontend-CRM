/**
 * Documentation Redux slice
 * Manages GitHub repository documentation state using Redux Toolkit
 * Following DEVELOPMENT_GUIDELINES.md patterns for state management
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getRepositoryContents, getFileContent, createFile, updateFile, deleteFile, createFolder } from '../../api/github'

/**
 * Fetch repository contents (files and directories)
 * @param {Object} params - Parameters for fetching contents
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} [params.path=''] - Path within repository
 * @param {string} [params.ref] - Branch, tag, or commit SHA
 */
export const fetchRepositoryContents = createAsyncThunk(
  'documentation/fetchRepositoryContents',
  async (params, { rejectWithValue }) => {
    try {
      const response = await getRepositoryContents(params)
      return {
        path: params.path || '',
        contents: response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch repository contents')
    }
  }
)

/**
 * Fetch specific file content
 * @param {Object} params - Parameters for fetching file content
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path within repository
 * @param {string} [params.ref] - Branch, tag, or commit SHA
 */
export const fetchFileContent = createAsyncThunk(
  'documentation/fetchFileContent',
  async (params, { rejectWithValue }) => {
    try {
      const response = await getFileContent(params)
      return {
        path: params.path,
        content: response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch file content')
    }
  }
)

/**
 * Create a new file in repository
 * @param {Object} params - Parameters for creating file
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to create
 * @param {string} params.content - File content
 * @param {string} params.message - Commit message
 * @param {string} [params.branch] - Branch to create file in
 */
export const createRepositoryFile = createAsyncThunk(
  'documentation/createRepositoryFile',
  async (params, { rejectWithValue }) => {
    try {
      const response = await createFile(params)
      return {
        path: params.path,
        operation: 'create',
        response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create file')
    }
  }
)

/**
 * Update an existing file in repository
 * @param {Object} params - Parameters for updating file
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to update
 * @param {string} params.content - New file content
 * @param {string} params.message - Commit message
 * @param {string} params.sha - Current file SHA
 * @param {string} [params.branch] - Branch to update file in
 */
export const updateRepositoryFile = createAsyncThunk(
  'documentation/updateRepositoryFile',
  async (params, { rejectWithValue }) => {
    try {
      const response = await updateFile(params)
      return {
        path: params.path,
        operation: 'update',
        response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update file')
    }
  }
)

/**
 * Delete a file from repository
 * @param {Object} params - Parameters for deleting file
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - File path to delete
 * @param {string} params.message - Commit message
 * @param {string} params.sha - Current file SHA
 * @param {string} [params.branch] - Branch to delete file from
 */
export const deleteRepositoryFile = createAsyncThunk(
  'documentation/deleteRepositoryFile',
  async (params, { rejectWithValue }) => {
    try {
      const response = await deleteFile(params)
      return {
        path: params.path,
        operation: 'delete',
        response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete file')
    }
  }
)

/**
 * Create a new folder in repository
 * @param {Object} params - Parameters for creating folder
 * @param {string} params.owner - GitHub owner/org
 * @param {string} params.repo - Repository name
 * @param {string} params.path - Folder path to create
 * @param {string} [params.message] - Commit message
 * @param {string} [params.branch] - Branch to create folder in
 */
export const createRepositoryFolder = createAsyncThunk(
  'documentation/createRepositoryFolder',
  async (params, { rejectWithValue }) => {
    try {
      const response = await createFolder(params)
      return {
        path: params.path,
        operation: 'createFolder',
        response,
        params
      }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create folder')
    }
  }
)

const documentationSlice = createSlice({
  name: 'documentation',
  initialState: {
    // Repository contents state
    contents: {},
    contentsLoading: false,
    contentsError: null,
    
    // File content state
    files: {},
    fileLoading: false,
    fileError: null,
    
    // File operations state
    fileOperationLoading: false,
    fileOperationError: null,
    lastOperation: null,
    
    // Current selection state
    selectedFile: null,
    currentPath: '',
    
    // Repository info
    currentRepo: null
  },
  reducers: {
    /**
     * Clear all errors
     */
    clearErrors: (state) => {
      state.contentsError = null
      state.fileError = null
      state.fileOperationError = null
    },
    
    /**
     * Clear contents error
     */
    clearContentsError: (state) => {
      state.contentsError = null
    },
    
    /**
     * Clear file error
     */
    clearFileError: (state) => {
      state.fileError = null
    },
    
    /**
     * Clear file operation error
     */
    clearFileOperationError: (state) => {
      state.fileOperationError = null
    },
    
    /**
     * Set selected file
     */
    setSelectedFile: (state, action) => {
      state.selectedFile = action.payload
    },
    
    /**
     * Set current path
     */
    setCurrentPath: (state, action) => {
      state.currentPath = action.payload
    },
    
    /**
     * Set current repository
     */
    setCurrentRepo: (state, action) => {
      state.currentRepo = action.payload
    },
    
    /**
     * Clear all documentation state
     */
    clearDocumentation: (state) => {
      state.contents = {}
      state.files = {}
      state.selectedFile = null
      state.currentPath = ''
      state.currentRepo = null
      state.contentsError = null
      state.fileError = null
      state.fileOperationError = null
      state.lastOperation = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch repository contents
      .addCase(fetchRepositoryContents.pending, (state) => {
        state.contentsLoading = true
        state.contentsError = null
      })
      .addCase(fetchRepositoryContents.fulfilled, (state, action) => {
        state.contentsLoading = false
        const { path, contents } = action.payload
        state.contents[path] = contents
        state.currentPath = path
      })
      .addCase(fetchRepositoryContents.rejected, (state, action) => {
        state.contentsLoading = false
        state.contentsError = action.payload
      })
      
      // Fetch file content
      .addCase(fetchFileContent.pending, (state) => {
        state.fileLoading = true
        state.fileError = null
      })
      .addCase(fetchFileContent.fulfilled, (state, action) => {
        state.fileLoading = false
        const { path, content } = action.payload
        state.files[path] = content
        state.selectedFile = path
      })
      .addCase(fetchFileContent.rejected, (state, action) => {
        state.fileLoading = false
        state.fileError = action.payload
      })
      
      // File operations
      .addCase(createRepositoryFile.pending, (state) => {
        state.fileOperationLoading = true
        state.fileOperationError = null
      })
      .addCase(createRepositoryFile.fulfilled, (state, action) => {
        state.fileOperationLoading = false
        state.lastOperation = action.payload
        // Invalidate contents cache for the parent directory
        const parentPath = action.payload.path.split('/').slice(0, -1).join('/')
        if (state.contents[parentPath]) {
          delete state.contents[parentPath]
        }
      })
      .addCase(createRepositoryFile.rejected, (state, action) => {
        state.fileOperationLoading = false
        state.fileOperationError = action.payload
      })
      
      .addCase(updateRepositoryFile.pending, (state) => {
        state.fileOperationLoading = true
        state.fileOperationError = null
      })
      .addCase(updateRepositoryFile.fulfilled, (state, action) => {
        state.fileOperationLoading = false
        state.lastOperation = action.payload
        // Update file cache if it exists
        if (state.files[action.payload.path]) {
          delete state.files[action.payload.path]
        }
      })
      .addCase(updateRepositoryFile.rejected, (state, action) => {
        state.fileOperationLoading = false
        state.fileOperationError = action.payload
      })
      
      .addCase(deleteRepositoryFile.pending, (state) => {
        state.fileOperationLoading = true
        state.fileOperationError = null
      })
      .addCase(deleteRepositoryFile.fulfilled, (state, action) => {
        state.fileOperationLoading = false
        state.lastOperation = action.payload
        // Remove file from cache
        if (state.files[action.payload.path]) {
          delete state.files[action.payload.path]
        }
        // Invalidate contents cache for the parent directory
        const parentPath = action.payload.path.split('/').slice(0, -1).join('/')
        if (state.contents[parentPath]) {
          delete state.contents[parentPath]
        }
        // Clear selected file if it was deleted
        if (state.selectedFile && state.selectedFile.path === action.payload.path) {
          state.selectedFile = null
        }
      })
      .addCase(deleteRepositoryFile.rejected, (state, action) => {
        state.fileOperationLoading = false
        state.fileOperationError = action.payload
      })
      
      .addCase(createRepositoryFolder.pending, (state) => {
        state.fileOperationLoading = true
        state.fileOperationError = null
      })
      .addCase(createRepositoryFolder.fulfilled, (state, action) => {
        state.fileOperationLoading = false
        state.lastOperation = action.payload
        // Invalidate contents cache for the parent directory
        const parentPath = action.payload.path.split('/').slice(0, -1).join('/')
        if (state.contents[parentPath]) {
          delete state.contents[parentPath]
        }
      })
      .addCase(createRepositoryFolder.rejected, (state, action) => {
        state.fileOperationLoading = false
        state.fileOperationError = action.payload
      })
  }
})

// Export actions
export const {
  clearErrors,
  clearContentsError,
  clearFileError,
  clearFileOperationError,
  setSelectedFile,
  setCurrentPath,
  setCurrentRepo,
  clearDocumentation
} = documentationSlice.actions

// Export selectors
export const selectDocumentation = (state) => state.documentation
export const selectContents = (state) => state.documentation.contents
export const selectFiles = (state) => state.documentation.files
export const selectSelectedFile = (state) => state.documentation.selectedFile
export const selectCurrentPath = (state) => state.documentation.currentPath
export const selectCurrentRepo = (state) => state.documentation.currentRepo
export const selectContentsLoading = (state) => state.documentation.contentsLoading
export const selectFileLoading = (state) => state.documentation.fileLoading
export const selectContentsError = (state) => state.documentation.contentsError
export const selectFileError = (state) => state.documentation.fileError

// Export reducer
export default documentationSlice.reducer