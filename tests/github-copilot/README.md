# Skill Test Template

Use this template to create tests for a new skill.

## Quick Start

1. **Copy the template folder:**
   ```bash
   cp -r tests/_template tests/{your-skill-name}
   ```

2. **Update skill name** in each test file:
   ```javascript
   const SKILL_NAME = 'your-skill-name';  // Change this
   ```

3. **Add trigger prompts** in `triggers.test.js`:
   ```javascript
   const shouldTriggerPrompts = [
     'Your prompt that should trigger',
     'Another triggering prompt',
   ];
   ```

4. **Add fixtures** in `fixtures/` folder for test data

5. **Run tests:**
   ```bash
   npm test -- --testPathPattern=your-skill-name
   ```

## File Structure

```
your-skill-name/
├── unit.test.js        # Isolated logic tests
├── triggers.test.js    # Skill activation tests
├── integration.test.js # MCP tool interaction tests
└── fixtures/
    └── sample.json     # Test data
```

## Test Types

### Unit Tests (`unit.test.js`)
- Test skill metadata (SKILL.md parsing)
- Test validation logic
- Test utility functions

### Trigger Tests (`triggers.test.js`)
- Verify correct prompts activate the skill
- Verify unrelated prompts don't activate
- Snapshot test for keyword changes

### Integration Tests (`integration.test.js`)
- Test MCP tool interactions with mocks
- Test error handling
- Test end-to-end skill behavior

## Running Tests

```bash
# Run all tests for a skill
npm test -- --testPathPattern=your-skill-name

# Run with coverage
npm run test:coverage -- --testPathPattern=your-skill-name

# Update snapshots
npm run update:snapshots -- --testPathPattern=your-skill-name

# Watch mode during development
npm run test:watch -- --testPathPattern=your-skill-name
```

## Best Practices

1. **Keep tests focused** - One assertion per test when possible
2. **Use descriptive names** - `test('validates 24-char limit for storage names')`
3. **Test edge cases** - Empty input, very long input, special characters
4. **Update snapshots intentionally** - Review changes before committing
5. **Add fixtures for complex data** - Don't hardcode large test data

See `/tests/AGENTS.md` for complete testing patterns and guidelines.
