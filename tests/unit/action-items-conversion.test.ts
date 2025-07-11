import { jest } from '@jest/globals';
import { ProseMirrorConverter } from '../../src/converter';
import { GranolaSettings, DEFAULT_SETTINGS, Logger, LogLevel } from '../../src/types';

// Mock logger for testing
const createMockLogger = (): Logger => {
	const mockSettings = { debug: { enabled: false, logLevel: LogLevel.ERROR } } as GranolaSettings;
	return new Logger(mockSettings);
};

describe('Action Items Conversion', () => {
	let converter: ProseMirrorConverter;
	let settings: GranolaSettings;
	let logger: Logger;

	beforeEach(() => {
		logger = createMockLogger();
		settings = {
			...DEFAULT_SETTINGS,
			actionItems: {
				convertToTasks: true,
				addTaskTag: true,
				taskTagName: '#tasks',
			},
		};
		converter = new ProseMirrorConverter(logger, settings);
	});

	describe('processActionItems', () => {
		it('should convert bullet points under Action Items header to tasks', () => {
			const markdown = `# Meeting Notes

## Discussion Points
- Reviewed quarterly goals
- Discussed budget allocation

## Action Items
- Follow up with engineering team
- Schedule client review meeting
- Update project timeline

## Next Steps
- Continue with implementation`;

			// Use reflection to access private method
			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Follow up with engineering team');
			expect(result).toContain('- [ ] Schedule client review meeting');
			expect(result).toContain('- [ ] Update project timeline');
			expect(result).toContain('#tasks');
			// Non-action items should remain as bullets
			expect(result).toContain('- Reviewed quarterly goals');
			expect(result).toContain('- Continue with implementation');
		});

		it('should handle multiple action items sections', () => {
			const markdown = `# Meeting Notes

## Action Items
- First task
- Second task

## Discussion

## TODO
- Third task
- Fourth task`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] First task');
			expect(result).toContain('- [ ] Second task');
			expect(result).toContain('- [ ] Third task');
			expect(result).toContain('- [ ] Fourth task');
			// Should have two tags
			expect((result.match(/#tasks/g) || []).length).toBe(2);
		});

		it('should handle case insensitive headers', () => {
			const markdown = `## action items
- Task one

### ACTIONS
- Task two

## todo
- Task three`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Task one');
			expect(result).toContain('- [ ] Task two');
			expect(result).toContain('- [ ] Task three');
		});

		it('should preserve indentation', () => {
			const markdown = `## Action Items
    - Indented task
        - Deeply indented task`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('    - [ ] Indented task');
			expect(result).toContain('        - [ ] Deeply indented task');
		});

		it('should not be called when convertToTasks is disabled', () => {
			// This test verifies that the processActionItems method itself works
			// The actual control flow (not calling it when disabled) is tested in integration
			settings.actionItems.convertToTasks = false;
			converter = new ProseMirrorConverter(logger, settings);

			const markdown = `## Action Items
- Task one
- Task two`;

			// processActionItems always converts if called - the check happens in convertDocument
			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Task one');
			expect(result).toContain('- [ ] Task two');
		});

		it('should not add tags when addTaskTag is disabled', () => {
			settings.actionItems.addTaskTag = false;
			converter = new ProseMirrorConverter(logger, settings);

			const markdown = `## Action Items
- Task one
- Task two`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Task one');
			expect(result).toContain('- [ ] Task two');
			expect(result).not.toContain('#tasks');
		});

		it('should use custom tag name', () => {
			settings.actionItems.taskTagName = '#my-tasks';
			converter = new ProseMirrorConverter(logger, settings);

			const markdown = `## Action Items
- Task one`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('#my-tasks');
			expect(result).not.toContain('#tasks');
		});

		it('should handle asterisk bullets', () => {
			const markdown = `## Action Items
* Task with asterisk
* Another asterisk task`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Task with asterisk');
			expect(result).toContain('- [ ] Another asterisk task');
		});

		it('should handle empty markdown', () => {
			const result = (converter as any).processActionItems('');
			expect(result).toBe('');
		});

		it('should handle markdown with no action items', () => {
			const markdown = `# Regular Document
- Regular bullet
- Another bullet`;

			const result = (converter as any).processActionItems(markdown);
			expect(result).toBe(markdown); // Should be unchanged
		});

		it('should handle action items at end of document', () => {
			const markdown = `# Meeting Notes

## Action Items
- Final task
- Last task`;

			const result = (converter as any).processActionItems(markdown);

			expect(result).toContain('- [ ] Final task');
			expect(result).toContain('- [ ] Last task');
			expect(result).toContain('#tasks');
		});
	});
});