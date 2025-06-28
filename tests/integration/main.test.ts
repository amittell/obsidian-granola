import { jest } from '@jest/globals';
import GranolaImporterPlugin from '../../main';
import { mockApp, mockVault, Notice } from '../__mocks__/obsidian';
import { createMockFs, mockDocument, mockCredentials } from '../helpers';

// Mock the source modules completely
jest.mock('../../src/auth', () => ({
  GranolaAuth: jest.fn().mockImplementation(() => ({
    loadCredentials: jest.fn().mockResolvedValue(mockCredentials),
    getBearerToken: jest.fn().mockReturnValue('test-token'),
    hasValidCredentials: jest.fn().mockReturnValue(true),
    isTokenExpired: jest.fn().mockReturnValue(false),
    clearCredentials: jest.fn(),
    refreshToken: jest.fn()
  }))
}));

jest.mock('../../src/api', () => ({
  GranolaAPI: jest.fn().mockImplementation(() => ({
    getAllDocuments: jest.fn().mockResolvedValue([mockDocument]),
    getDocuments: jest.fn().mockResolvedValue({ 
      documents: [mockDocument], 
      total_count: 1, 
      has_more: false 
    })
  }))
}));

jest.mock('../../src/converter', () => ({
  ProseMirrorConverter: jest.fn().mockImplementation(() => ({
    convertDocument: jest.fn().mockReturnValue({
      filename: 'Test Document.md',
      content: '---\nid: test-doc-id\ntitle: "Test Document"\n---\n\n# Test Document\n\nTest content',
      frontmatter: {
        id: 'test-doc-id',
        title: 'Test Document',
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-01T00:00:00.000Z',
        source: 'Granola'
      }
    })
  }))
}));

describe('GranolaImporterPlugin Integration', () => {
  let plugin: GranolaImporterPlugin;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup filesystem mocks
    createMockFs();

    // Create plugin instance
    plugin = new GranolaImporterPlugin(mockApp as any, {
      id: 'granola-importer',
      name: 'Granola Importer',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Import Granola notes',
      author: 'Test',
      authorUrl: 'https://example.com',
      isDesktopOnly: false
    });

    // Mock vault operations
    mockVault.getAbstractFileByPath.mockReturnValue(null);
    mockVault.create.mockResolvedValue(undefined);
    mockVault.modify.mockResolvedValue(undefined);
  });

  describe('onload', () => {
    it('should initialize plugin components and register command', async () => {
      const addCommandSpy = jest.spyOn(plugin, 'addCommand');

      await plugin.onload();

      expect(addCommandSpy).toHaveBeenCalledWith({
        id: 'import-granola-notes',
        name: 'Import Granola Notes',
        callback: expect.any(Function)
      });
    });

    it('should log loading message', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.onload();

      expect(consoleSpy).toHaveBeenCalledWith('Loading Granola Importer Plugin');
      consoleSpy.mockRestore();
    });
  });

  describe('onunload', () => {
    it('should log unloading message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      plugin.onunload();

      expect(consoleSpy).toHaveBeenCalledWith('Unloading Granola Importer Plugin');
      consoleSpy.mockRestore();
    });
  });

  describe('importGranolaNotes', () => {
    beforeEach(async () => {
      await plugin.onload();
    });

    it('should complete successful import workflow', async () => {
      // Override the plugin's instances with properly mocked ones
      const { GranolaAuth } = require('../../src/auth');
      const { GranolaAPI } = require('../../src/api');
      const { ProseMirrorConverter } = require('../../src/converter');
      
      const mockAuthInstance = new GranolaAuth();
      const mockApiInstance = new GranolaAPI();
      const mockConverterInstance = new ProseMirrorConverter();
      
      (plugin as any).auth = mockAuthInstance;
      (plugin as any).api = mockApiInstance;
      (plugin as any).converter = mockConverterInstance;

      await plugin.importGranolaNotes();

      // These checks are less specific since we're mocking the classes themselves
      expect(mockVault.create).toHaveBeenCalledWith(
        'Test Document.md',
        expect.stringContaining('# Test Document')
      );
    });

    it('should handle empty document list', async () => {
      // Mock empty response for this test
      const { GranolaAPI } = require('../../src/api');
      const mockApiInstance = new GranolaAPI();
      mockApiInstance.getAllDocuments.mockResolvedValueOnce([]);
      
      // Override the plugin's API instance
      (plugin as any).api = mockApiInstance;

      await plugin.importGranolaNotes();

      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it('should handle null document list', async () => {
      // Mock null response for this test
      const { GranolaAPI } = require('../../src/api');
      const mockApiInstance = new GranolaAPI();
      mockApiInstance.getAllDocuments.mockResolvedValueOnce(null);
      
      // Override the plugin's API instance
      (plugin as any).api = mockApiInstance;

      await plugin.importGranolaNotes();

      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it('should update existing files instead of creating new ones', async () => {
      // Override the plugin's instances with properly mocked ones
      const { GranolaAuth } = require('../../src/auth');
      const { GranolaAPI } = require('../../src/api');
      const { ProseMirrorConverter } = require('../../src/converter');
      
      const mockAuthInstance = new GranolaAuth();
      const mockApiInstance = new GranolaAPI();
      const mockConverterInstance = new ProseMirrorConverter();
      
      (plugin as any).auth = mockAuthInstance;
      (plugin as any).api = mockApiInstance;
      (plugin as any).converter = mockConverterInstance;

      // Import TFile from the mocked obsidian module to create a proper instance
      const { TFile } = require('../__mocks__/obsidian');
      const mockExistingFile = new TFile('Test Document.md');
      mockVault.getAbstractFileByPath.mockReturnValue(mockExistingFile);

      await plugin.importGranolaNotes();

      expect(mockVault.modify).toHaveBeenCalledWith(
        mockExistingFile,
        expect.stringContaining('# Test Document')
      );
      expect(mockVault.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await plugin.onload();
    });

    it('should handle credential errors', async () => {
      // Mock credential error
      const { GranolaAuth } = require('../../src/auth');
      const mockAuthInstance = new GranolaAuth();
      mockAuthInstance.loadCredentials.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      // Override the plugin's auth instance
      (plugin as any).auth = mockAuthInstance;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await plugin.importGranolaNotes();

      expect(consoleSpy).toHaveBeenCalledWith('Granola import failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      // Mock network error
      const { GranolaAPI } = require('../../src/api');
      const mockApiInstance = new GranolaAPI();
      mockApiInstance.getAllDocuments.mockRejectedValueOnce(new Error('Network connection failed'));
      
      // Override the plugin's API instance
      (plugin as any).api = mockApiInstance;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await plugin.importGranolaNotes();

      expect(consoleSpy).toHaveBeenCalledWith('Granola import failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});