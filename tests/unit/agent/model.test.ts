/**
 * ModelResolver 单元测试
 * 测试环境变量解析、模型选择和覆盖逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pi-ai module before importing modelResolver
vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn((provider: string, modelId: string) => {
    if (modelId === 'test-model') {
      return { id: modelId, provider, name: 'Test Model', api: 'openai', baseUrl: 'https://api.test.com' };
    }
    if (modelId === 'glm-4.7') {
      return { id: modelId, provider, name: 'GLM 4.7', api: 'openai', baseUrl: 'https://api.zhipu.ai' };
    }
    return null;
  }),
  getModels: vi.fn((provider: string) => {
    if (provider === 'minimax') {
      return [
        { id: 'fallback-model', provider, name: 'Fallback Model', api: 'openai', baseUrl: 'https://api.test.com' },
      ];
    }
    if (provider === 'zai') {
      return [
        { id: 'glm-4.7', provider, name: 'GLM 4.7', api: 'openai', baseUrl: 'https://api.zhipu.ai' },
      ];
    }
    return [];
  }),
}));

// We need to test the class, so we'll import and re-export, or test via the singleton
// Since modelResolver is a singleton, we need to reset it between tests
import { modelResolver } from '../../../src/agent/model.js';

describe('ModelResolver 单元测试', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('resolveEnvProvider', () => {
    it('应该返回 DEFAULT_PROVIDER 环境变量', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      // Re-import to get fresh instance
      vi.resetModules();
      // Note: modelResolver singleton is cached, so we test via resolve() behavior
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
    });

    it('当无 DEFAULT_PROVIDER 时应该返回 null', () => {
      delete process.env.DEFAULT_PROVIDER;
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).toBeNull();
    });
  });

  describe('resolveModelId - 环境变量覆盖', () => {
    it('应该读取 {PROVIDER}_MODEL 环境变量', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      process.env.MINIMAX_MODEL = 'test-model';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-model');
    });

    it('provider 名称中的横杠应转换为下划线', () => {
      process.env.DEFAULT_PROVIDER = 'minimax-cn';
      process.env['MINIMAX_CN_MODEL'] = 'test-model';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
    });
  });

  describe('applyEnvOverrides - baseUrl 和 api 覆盖', () => {
    it('应该使用环境变量覆盖 baseUrl', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      process.env.MINIMAX_BASE_URL = 'https://custom.api.com';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      expect(result?.baseUrl).toBe('https://custom.api.com');
    });

    it('应该使用环境变量覆盖 api 类型', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      process.env.MINIMAX_API = 'openai-chat';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      expect(result?.api).toBe('openai-chat');
    });

    it('当环境变量不存在时应使用模型默认值', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      delete process.env.MINIMAX_BASE_URL;
      delete process.env.MINIMAX_API;
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      // 应使用 fallback model 的 baseUrl
      expect(result?.baseUrl).toBe('https://api.test.com');
    });
  });

  describe('resolveFallbackModel', () => {
    it('当指定模型不存在时应返回 fallback', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      process.env.MINIMAX_MODEL = 'nonexistent-model';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      expect(result?.id).toBe('fallback-model');
    });
  });

  describe('集成测试', () => {
    it('完整流程：minimax provider + model + overrides', () => {
      process.env.DEFAULT_PROVIDER = 'minimax';
      process.env.MINIMAX_MODEL = 'test-model';
      process.env.MINIMAX_BASE_URL = 'https://custom.minimax.ai';
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-model');
      expect(result?.baseUrl).toBe('https://custom.minimax.ai');
    });

    it('空环境变量应返回 null', () => {
      process.env = {};
      vi.resetModules();
      const result = modelResolver.resolve();
      expect(result).toBeNull();
    });
  });
});
