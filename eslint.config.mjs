import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		ignores: [
			'main.js',
			'node_modules/**',
			'dist/**',
			'docs/**',
			'coverage/**',
			'.obsidian/**',
			'tests/**',
			'*.js',
			'!*.config.js',
			'esbuild.config.mjs',
			'version-bump.mjs',
			'jest.config.js',
		],
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: {
			'@typescript-eslint': typescriptEslint,
		},
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json',
			},
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'none',
					varsIgnorePattern: '^_',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-prototype-builtins': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/require-await': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
		},
	},
];
