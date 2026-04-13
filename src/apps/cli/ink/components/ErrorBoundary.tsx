/**
 * ErrorBoundary - Catches React render errors and displays a graceful error message
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * Or with custom error UI:
 * <ErrorBoundary fallback={(error) => <CustomError error={error} />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
import React, { Component, ReactNode } from 'react';
import { Box, Text } from 'ink';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return <>{fallback(error, errorInfo || { componentStack: '' })}</>;
      }

      // Default error UI using Ink components
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single" borderColor="red">
          <Box>
            <Text color="red" bold>⚠ Error Boundary Caught an Error</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="red">{error.message}</Text>
          </Box>
          {errorInfo && errorInfo.componentStack && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="gray" dimColor>Component Stack:</Text>
              <Text color="gray" dimColor>{errorInfo.componentStack}</Text>
            </Box>
          )}
        </Box>
      );
    }

    return children;
  }
}
