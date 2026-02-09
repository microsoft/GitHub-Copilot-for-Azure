/**
 * Jest Global Setup
 *
 * Runs exactly once before all workers start.
 * Use this to set values that must be identical across parallel test files.
 */

export default function globalSetup() {
  // Single timestamp shared by every worker via the environment
  // Used for DEBUG file creation
  process.env.START_TIMESTAMP = new Date().toISOString();
}
