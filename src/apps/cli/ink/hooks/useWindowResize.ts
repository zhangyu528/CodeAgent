import { useEffect, useCallback } from 'react';
import { useStdout } from 'ink';

interface WindowDimensions {
  columns: number;
  rows: number;
}

interface UseWindowResizeOptions {
  onResize?: (dimensions: WindowDimensions) => void;
}

export function useWindowResize(options: UseWindowResizeOptions = {}) {
  const { stdout } = useStdout();
  const { onResize } = options;

  const dimensions: WindowDimensions = {
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
  };

  useEffect(() => {
    const handleResize = () => {
      const newDimensions = {
        columns: stdout.columns || 80,
        rows: stdout.rows || 24,
      };
      onResize?.(newDimensions);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout, onResize]);

  return dimensions;
}
