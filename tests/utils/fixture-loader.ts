import * as fs from 'fs';
import * as path from 'path';
import type { AzureService, Confidence } from './project-scanner';

export interface ExpectedResult {
  service: AzureService;
  confidence: Confidence;
  framework?: string;
}

export interface Expectations {
  [fixtureName: string]: ExpectedResult;
}

const FIXTURES_PATH = path.join(__dirname, '..', 'fixtures');
const PROJECTS_PATH = path.join(FIXTURES_PATH, 'projects');
const EXPECTATIONS_PATH = path.join(FIXTURES_PATH, 'expectations.json');

/**
 * Get the path to the fixtures directory
 */
export function getFixturesPath(): string {
  return FIXTURES_PATH;
}

/**
 * Get the path to a specific project fixture
 */
export function getProjectPath(fixtureName: string): string {
  return path.join(PROJECTS_PATH, fixtureName);
}

/**
 * Get all available project fixture names
 */
export function listProjectFixtures(): string[] {
  if (!fs.existsSync(PROJECTS_PATH)) {
    return [];
  }
  
  return fs.readdirSync(PROJECTS_PATH, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * Load expectations from expectations.json
 */
export function loadExpectations(): Expectations {
  if (!fs.existsSync(EXPECTATIONS_PATH)) {
    throw new Error(`Expectations file not found: ${EXPECTATIONS_PATH}`);
  }
  
  const content = fs.readFileSync(EXPECTATIONS_PATH, 'utf-8');
  return JSON.parse(content) as Expectations;
}

/**
 * Get expected result for a specific fixture
 */
export function getExpectedResult(fixtureName: string): ExpectedResult | undefined {
  const expectations = loadExpectations();
  return expectations[fixtureName];
}

/**
 * Validate that all fixtures have expectations defined
 */
export function validateFixturesHaveExpectations(): { 
  valid: boolean; 
  missing: string[]; 
  extra: string[] 
} {
  const fixtures = listProjectFixtures();
  const expectations = loadExpectations();
  const expectedNames = Object.keys(expectations);
  
  const missing = fixtures.filter(f => !expectedNames.includes(f));
  const extra = expectedNames.filter(e => !fixtures.includes(e));
  
  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}
