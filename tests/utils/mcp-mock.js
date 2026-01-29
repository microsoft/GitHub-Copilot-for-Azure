/**
 * MCP Mock Utility
 * 
 * Provides mock implementations for Azure MCP tools used in integration tests.
 */

/**
 * Create a mock MCP client for testing
 * @returns {McpMock}
 */
function createMcpMock() {
  return new McpMock();
}

/**
 * MCP Mock class for simulating Azure MCP tool responses
 */
class McpMock {
  constructor() {
    this.responses = new Map();
    this.errors = new Map();
    this.calls = new Map();
  }

  /**
   * Mock a successful response for an MCP tool
   * @param {string} toolName - Name of the tool (e.g., 'azure__bicepschema')
   * @param {*} response - Response data to return
   */
  mockResponse(toolName, response) {
    this.responses.set(toolName, response);
    this.errors.delete(toolName);
  }

  /**
   * Mock an error response for an MCP tool
   * @param {string} toolName - Name of the tool
   * @param {Error} error - Error to throw
   */
  mockError(toolName, error) {
    this.errors.set(toolName, error);
    this.responses.delete(toolName);
  }

  /**
   * Call a mocked MCP tool
   * @param {string} toolName - Name of the tool
   * @param {object} params - Parameters passed to the tool
   * @returns {Promise<*>}
   */
  async call(toolName, params = {}) {
    // Record the call
    if (!this.calls.has(toolName)) {
      this.calls.set(toolName, []);
    }
    this.calls.get(toolName).push({ params, timestamp: Date.now() });

    // Check for error mock
    if (this.errors.has(toolName)) {
      throw this.errors.get(toolName);
    }

    // Return mocked response
    if (this.responses.has(toolName)) {
      return this.responses.get(toolName);
    }

    // Default response for unknown tools
    return { success: true, toolName, params };
  }

  /**
   * Get all calls made to a tool
   * @param {string} toolName - Name of the tool
   * @returns {Array<{params: object, timestamp: number}>}
   */
  getCalls(toolName) {
    return this.calls.get(toolName) || [];
  }

  /**
   * Get total number of calls to a tool
   * @param {string} toolName - Name of the tool
   * @returns {number}
   */
  getCallCount(toolName) {
    return this.getCalls(toolName).length;
  }

  /**
   * Check if a tool was called
   * @param {string} toolName - Name of the tool
   * @returns {boolean}
   */
  wasCalled(toolName) {
    return this.getCallCount(toolName) > 0;
  }

  /**
   * Reset all mocks and call history
   */
  reset() {
    this.responses.clear();
    this.errors.clear();
    this.calls.clear();
  }

  /**
   * Reset only call history, keep mocked responses
   */
  resetCalls() {
    this.calls.clear();
  }
}

// Common mock responses for Azure tools
const commonMocks = {
  'azure__bicepschema': {
    storageAccount: {
      type: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2023-01-01',
      properties: {
        name: { type: 'string', minLength: 3, maxLength: 24, pattern: '^[a-z0-9]+$' },
        sku: { type: 'object', required: ['name'] },
        kind: { type: 'string', enum: ['Storage', 'StorageV2', 'BlobStorage'] }
      }
    },
    keyVault: {
      type: 'Microsoft.KeyVault/vaults',
      apiVersion: '2023-07-01',
      properties: {
        name: { type: 'string', minLength: 3, maxLength: 24 }
      }
    }
  },
  'azure__subscription_list': [
    { id: 'sub-1', name: 'Development', state: 'Enabled' },
    { id: 'sub-2', name: 'Production', state: 'Enabled' }
  ],
  'azure__group_list': [
    { id: 'rg-1', name: 'rg-dev', location: 'eastus' },
    { id: 'rg-2', name: 'rg-prod', location: 'westus2' }
  ]
};

/**
 * Create MCP mock with common Azure responses pre-configured
 * @returns {McpMock}
 */
function createMcpMockWithDefaults() {
  const mock = new McpMock();
  
  mock.mockResponse('azure__subscription_list', commonMocks['azure__subscription_list']);
  mock.mockResponse('azure__group_list', commonMocks['azure__group_list']);
  
  return mock;
}

module.exports = {
  createMcpMock,
  createMcpMockWithDefaults,
  McpMock,
  commonMocks
};
