/**
 * Fixtures Utility
 * 
 * Helper functions for loading and managing test fixtures.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PromptFixtures {
  shouldTrigger: string[];
  shouldNotTrigger: string[];
}

/**
 * Load fixtures for a skill
 */
export function loadFixtures(skillName: string): Record<string, unknown> {
  const fixturesPath = path.join(
    global.TESTS_PATH || path.join(__dirname, '..'),
    skillName,
    'fixtures'
  );

  if (!fs.existsSync(fixturesPath)) {
    return {};
  }

  const fixtures: Record<string, unknown> = {};
  const files = fs.readdirSync(fixturesPath);

  for (const file of files) {
    const filePath = path.join(fixturesPath, file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);

    try {
      if (ext === '.json') {
        fixtures[name] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else if (ext === '.txt' || ext === '.md') {
        fixtures[name] = fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error) {
      console.warn(`Failed to load fixture ${file}: ${(error as Error).message}`);
    }
  }

  return fixtures;
}

/**
 * Load a specific fixture file
 */
export function loadFixture<T = unknown>(
  skillName: string, 
  fixtureName: string, 
  extension = 'json'
): T {
  const fixturePath = path.join(
    global.TESTS_PATH || path.join(__dirname, '..'),
    skillName,
    'fixtures',
    `${fixtureName}.${extension}`
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }

  const content = fs.readFileSync(fixturePath, 'utf-8');

  if (extension === 'json') {
    return JSON.parse(content) as T;
  }

  return content as unknown as T;
}

/**
 * Create a fixture file for a skill
 */
export function createFixture(
  skillName: string, 
  fixtureName: string, 
  content: unknown, 
  extension = 'json'
): void {
  const fixturesDir = path.join(
    global.TESTS_PATH || path.join(__dirname, '..'),
    skillName,
    'fixtures'
  );

  // Ensure fixtures directory exists
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const fixturePath = path.join(fixturesDir, `${fixtureName}.${extension}`);
  const fileContent = extension === 'json' 
    ? JSON.stringify(content, null, 2) 
    : String(content);

  fs.writeFileSync(fixturePath, fileContent, 'utf-8');
}

/**
 * Load prompts from a fixture file
 */
export function loadPromptFixtures(skillName: string): PromptFixtures {
  try {
    const fixtures = loadFixture<PromptFixtures>(skillName, 'prompts');
    return {
      shouldTrigger: fixtures.shouldTrigger || [],
      shouldNotTrigger: fixtures.shouldNotTrigger || []
    };
  } catch {
    return { shouldTrigger: [], shouldNotTrigger: [] };
  }
}
