/**
 * Wraps an async route handler with error handling
 * @param {Function} fn - The async route handler function
 * @returns {Function} Express middleware function with error handling
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Formats error responses
 * @param {Error} err - The error object
 * @param {boolean} includeStack - Whether to include the error stack
 * @returns {Object} Formatted error response
 */
export const formatError = (err, includeStack = false) => {
  return {
    success: false,
    message: err.message,
    ...(includeStack && process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };
};

/**
 * Returns standard success response
 * @param {*} data - The data to return
 * @param {string} message - Optional success message
 * @returns {Object} Formatted success response
 */
export const successResponse = (data, message = '') => {
  return {
    success: true,
    ...(message && { message }),
    data
  };
};