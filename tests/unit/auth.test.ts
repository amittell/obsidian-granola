import { jest } from '@jest/globals';
import { GranolaAuth } from '../../src/auth';
import { mockCredentials } from '../helpers';

// Mock the filesystem and OS modules
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
}));

jest.mock('os', () => ({
  platform: jest.fn(),
  homedir: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn()
}));

describe('GranolaAuth', () => {
  let auth: GranolaAuth;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mocks with proper values
    const mockFs = require('fs/promises');
    const mockOs = require('os');
    const mockPath = require('path');
    
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockCredentials));
    mockOs.platform.mockReturnValue('darwin');
    mockOs.homedir.mockReturnValue('/Users/test');
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    
    // Create auth instance
    auth = new GranolaAuth();
  });

  describe('loadCredentials', () => {
    it('should load valid credentials successfully', async () => {
      const credentials = await auth.loadCredentials();
      
      expect(credentials).toEqual({
        access_token: mockCredentials.access_token,
        refresh_token: mockCredentials.refresh_token,
        token_type: 'bearer',
        expires_at: expect.any(Number)
      });
    });

    it('should cache credentials on subsequent calls', async () => {
      const mockFs = require('fs/promises');
      
      await auth.loadCredentials();
      await auth.loadCredentials();
      
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error if config file is missing', async () => {
      const mockFs = require('fs/promises');
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(auth.loadCredentials()).rejects.toThrow('Failed to load Granola credentials');
    });

    it('should throw error if config file contains invalid JSON', async () => {
      const mockFs = require('fs/promises');
      mockFs.readFile.mockResolvedValue('invalid json');
      
      await expect(auth.loadCredentials()).rejects.toThrow('Failed to load Granola credentials');
    });

    it('should throw error if required fields are missing', async () => {
      const mockFs = require('fs/promises');
      const invalidConfig = { access_token: 'test' }; // missing other fields
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      
      await expect(auth.loadCredentials()).rejects.toThrow('Missing required field');
    });

    it('should throw error if token type is not bearer', async () => {
      const mockFs = require('fs/promises');
      const invalidConfig = {
        ...mockCredentials,
        token_type: 'basic'
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      
      await expect(auth.loadCredentials()).rejects.toThrow('Invalid token type');
    });

    it('should throw error if token format is invalid', async () => {
      const mockFs = require('fs/promises');
      const invalidConfig = {
        ...mockCredentials,
        access_token: 'invalid-token-format'
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      
      await expect(auth.loadCredentials()).rejects.toThrow('Invalid token format');
    });

    it('should throw error if token is expired', async () => {
      const mockFs = require('fs/promises');
      const expiredConfig = {
        ...mockCredentials,
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(expiredConfig));
      
      await expect(auth.loadCredentials()).rejects.toThrow('Access token has expired');
    });
  });

  describe('getSupabaseConfigPath', () => {
    it('should return correct path for macOS', () => {
      const mockOs = require('os');
      const mockPath = require('path');
      
      mockOs.platform.mockReturnValue('darwin');
      mockOs.homedir.mockReturnValue('/Users/test');
      
      // Access the private method through any casting
      const configPath = (auth as any).getSupabaseConfigPath();
      
      expect(mockPath.join).toHaveBeenCalledWith(
        '/Users/test',
        'Library',
        'Application Support',
        'Granola',
        'supabase.json'
      );
    });

    it('should return correct path for Windows', () => {
      const mockOs = require('os');
      const mockPath = require('path');
      
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\test');
      
      const configPath = (auth as any).getSupabaseConfigPath();
      
      expect(mockPath.join).toHaveBeenCalledWith(
        'C:\\Users\\test',
        'AppData',
        'Roaming',
        'Granola',
        'supabase.json'
      );
    });

    it('should return correct path for Linux', () => {
      const mockOs = require('os');
      const mockPath = require('path');
      
      mockOs.platform.mockReturnValue('linux');
      mockOs.homedir.mockReturnValue('/home/test');
      
      const configPath = (auth as any).getSupabaseConfigPath();
      
      expect(mockPath.join).toHaveBeenCalledWith(
        '/home/test',
        '.config',
        'Granola',
        'supabase.json'
      );
    });

    it('should throw error for unsupported platform', () => {
      const mockOs = require('os');
      mockOs.platform.mockReturnValue('freebsd');
      
      expect(() => (auth as any).getSupabaseConfigPath()).toThrow('Unsupported platform');
    });
  });

  describe('getBearerToken', () => {
    it('should return access token when credentials are loaded', async () => {
      await auth.loadCredentials();
      const token = auth.getBearerToken();
      
      expect(token).toBe(mockCredentials.access_token);
    });

    it('should throw error when credentials are not loaded', () => {
      expect(() => auth.getBearerToken()).toThrow('Credentials not loaded');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', async () => {
      await auth.loadCredentials();
      
      expect(auth.isTokenExpired()).toBe(false);
    });

    it('should return true when credentials are not loaded', () => {
      expect(auth.isTokenExpired()).toBe(true);
    });
  });

  describe('hasValidCredentials', () => {
    it('should return true when credentials are loaded and valid', async () => {
      await auth.loadCredentials();
      
      expect(auth.hasValidCredentials()).toBe(true);
    });

    it('should return false when credentials are not loaded', () => {
      expect(auth.hasValidCredentials()).toBe(false);
    });
  });

  describe('clearCredentials', () => {
    it('should clear cached credentials', async () => {
      await auth.loadCredentials();
      expect(auth.hasValidCredentials()).toBe(true);
      
      auth.clearCredentials();
      expect(auth.hasValidCredentials()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should throw error as refresh is not implemented', async () => {
      await auth.loadCredentials();
      
      await expect(auth.refreshToken()).rejects.toThrow('Token refresh not yet implemented');
    });

    it('should throw error when no refresh token available', async () => {
      await expect(auth.refreshToken()).rejects.toThrow('No refresh token available');
    });

    it('should clear credentials on refresh failure', async () => {
      await auth.loadCredentials();
      expect(auth.hasValidCredentials()).toBe(true);
      
      try {
        await auth.refreshToken();
      } catch {
        // Expected to fail
      }
      
      expect(auth.hasValidCredentials()).toBe(false);
    });
  });
});