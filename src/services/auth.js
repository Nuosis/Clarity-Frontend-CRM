/**
 * Service for handling authentication
 */

const API_URL = process.env.FM_API_URL;
const API_KEY = process.env.FM_API_KEY;

/**
 * Logs in a user
 * @param {string} username - The username
 * @param {string} password - The password
 * @returns {Promise<Object>} The login response with token
 */
const login = async (username, password) => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password,
        apiKey: API_KEY
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Store the token in localStorage
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }

    return data;
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
};

/**
 * Creates a new user
 * @param {string} username - The new username
 * @param {string} password - The new password
 * @param {string} accessLevel - The access level (Standard or Admin)
 * @returns {Promise<Object>} The creation response
 */
const createUser = async (username, password, accessLevel = 'Standard') => {
  if (!['Standard', 'Admin'].includes(accessLevel)) {
    throw new Error('Access level must be either Standard or Admin');
  }

  try {
    const response = await fetch(`${API_URL}/createUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        newUserName: username,
        newPassword: password,
        accessLevel
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Create User Error:', error);
    throw error;
  }
};

/**
 * Logs out the current user
 */
const logout = () => {
  localStorage.removeItem('authToken');
};

/**
 * Checks if a user is currently logged in
 * @returns {boolean}
 */
const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};

/**
 * Gets the current authentication token
 * @returns {string|null}
 */
const getToken = () => {
  return localStorage.getItem('authToken');
};

export const auth = {
  login,
  createUser,
  logout,
  isAuthenticated,
  getToken
};
