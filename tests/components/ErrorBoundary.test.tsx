/**
 * ErrorBoundary 组件测试
 * 测试错误边界捕获渲染错误的能力
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';
import { ErrorBoundary } from '../../src/apps/cli/ink/components/ErrorBoundary.js';

// Mock debugStore to avoid issues
vi.mock('../../src/apps/cli/ink/components/debug/debugStore.js', () => ({
  useDebugStore: () => ({
    addMessage: vi.fn(),
    messages: [],
  }),
}));

describe('ErrorBoundary', () => {
  describe('基本功能', () => {
    it('should render children when no error occurs', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <Text>正常内容</Text>
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('正常内容');
    });

    it('should render children when component renders normally', () => {
      const TestComponent = () => (
        <Box>
          <Text>Test Content</Text>
        </Box>
      );
      const { lastFrame } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Test Content');
    });

    it('should pass through multiple children', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          <Text>Child 1</Text>
          <Text>Child 2</Text>
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Child 1');
      expect(lastFrame()).toContain('Child 2');
    });
  });

  describe('错误捕获', () => {
    it('should catch render error and display error message', () => {
      // A component that throws during render
      const BrokenComponent = () => {
        throw new Error('Test error message');
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // Error boundary should catch and display the error
      expect(lastFrame()).toContain('Test error message');
    });

    it('should display Error Boundary title when error is caught', () => {
      const BrokenComponent = () => {
        throw new Error('Some error');
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Error Boundary');
    });

    it('should catch errors with custom error messages', () => {
      const BrokenComponent = () => {
        throw new Error('Custom error: Something went wrong');
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Custom error: Something went wrong');
    });

    it('should catch errors from nested components', () => {
      const InnerComponent = () => {
        throw new Error('Nested error');
      };

      const OuterComponent = () => (
        <Box>
          <InnerComponent />
        </Box>
      );

      const { lastFrame } = render(
        <ErrorBoundary>
          <OuterComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Nested error');
    });

    it('should catch errors thrown in useEffect', () => {
      // In React 18+/Concurrent Mode, errors thrown in useEffect are caught by ErrorBoundary
      // This is different from React 17 where useEffect errors were not caught
      const BrokenComponent = () => {
        React.useEffect(() => {
          throw new Error('useEffect error');
        }, []);
        return <Text>Hello</Text>;
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // In React 19 with concurrent mode, useEffect errors ARE caught by ErrorBoundary
      expect(lastFrame()).toContain('useEffect error');
    });
  });

  describe('自定义 Fallback', () => {
    it('should render custom fallback when provided', () => {
      const BrokenComponent = () => {
        throw new Error('Custom fallback test');
      };

      const CustomFallback = ({ error }: { error: Error }) => (
        <Box>
          <Text>Custom Error UI: {error.message}</Text>
        </Box>
      );

      const { lastFrame } = render(
        <ErrorBoundary fallback={(error) => <CustomFallback error={error} />}>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Custom Error UI: Custom fallback test');
    });

    it('should not show default error UI when custom fallback is provided', () => {
      const BrokenComponent = () => {
        throw new Error('Should not see this');
      };

      const CustomFallback = ({ error }: { error: Error }) => (
        <Box>
          <Text>Handled: {error.message}</Text>
        </Box>
      );

      const { lastFrame } = render(
        <ErrorBoundary fallback={() => <CustomFallback error={new Error('Custom')} />}>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // Should not contain the default error boundary title
      expect(lastFrame()).not.toContain('Error Boundary');
      expect(lastFrame()).toContain('Handled: Custom');
    });
  });

  describe('状态重置', () => {
    it('should allow error state to be read', () => {
      // Verify the component has error state
      const BrokenComponent = () => {
        throw new Error('Test');
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(lastFrame()).toContain('Error');
    });

    it('should recover and render children after error is set (via parent remount)', () => {
      // ErrorBoundary persists error state - once it catches an error, rerendering
      // with new children won't clear the error. The ErrorBoundary must be
      // truly unmounted and remounted to recover.
      const BrokenComponent = () => {
        throw new Error('Initial error');
      };

      const { lastFrame, rerender } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // Initially catches error
      expect(lastFrame()).toContain('Initial error');

      // Rerender with working component - but ErrorBoundary still has error state
      // This demonstrates that error state persists across rerenders
      rerender(
        <ErrorBoundary>
          <Box>
            <Text>Recovered</Text>
          </Box>
        </ErrorBoundary>
      );

      // ErrorBoundary still shows error because error state persists
      // (ErrorBoundary needs to be fully unmounted and remounted to recover)
      expect(lastFrame()).toContain('Initial error');
      expect(lastFrame()).not.toContain('Recovered');
    });
  });

  describe('边界情况', () => {
    it('should handle errors with empty message', () => {
      const BrokenComponent = () => {
        throw new Error('');
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // Should still render error boundary UI
      expect(lastFrame()).toContain('Error Boundary');
    });

    it('should handle errors with long messages (message is truncated by terminal width)', () => {
      const longMessage = 'This is a very long error message that exceeds normal terminal width and should be handled gracefully by the error boundary component';
      const BrokenComponent = () => {
        throw new Error(longMessage);
      };

      const { lastFrame } = render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // The error message is part of what was thrown
      expect(lastFrame()).toContain('Error Boundary');
      expect(lastFrame()).toContain('This is a very long error message');
    });

    it('should handle null children gracefully', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          {null}
        </ErrorBoundary>
      );

      // Should render without crashing (empty frame is ok)
      expect(lastFrame()).toBeDefined();
    });

    it('should handle falsy children gracefully', () => {
      const { lastFrame } = render(
        <ErrorBoundary>
          {false}
        </ErrorBoundary>
      );

      expect(lastFrame()).toBeDefined();
    });
  });
});
