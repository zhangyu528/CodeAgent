/**
 * Simple unit test to verify setCurrentModel works correctly
 */
import { describe, it, expect } from 'vitest';
import { useAppStore } from '../../src/apps/cli/ink/store/uiStore.js';

describe('useAppStore setCurrentModel', () => {
  it('should update currentModel when setCurrentModel is called', () => {
    // Get the setCurrentModel function
    const setCurrentModel = useAppStore.getState().setCurrentModel;
    
    // Initial state should be null
    expect(useAppStore.getState().currentModel).toBeNull();
    
    // Call setCurrentModel with a model id
    setCurrentModel('gpt-4');
    
    // Verify currentModel was updated
    expect(useAppStore.getState().currentModel).toBe('gpt-4');
    
    // Change to another model
    setCurrentModel('claude-3-opus');
    expect(useAppStore.getState().currentModel).toBe('claude-3-opus');
  });

  it('should allow setting currentModel to null', () => {
    const setCurrentModel = useAppStore.getState().setCurrentModel;
    
    setCurrentModel('gpt-4');
    expect(useAppStore.getState().currentModel).toBe('gpt-4');
    
    setCurrentModel(null);
    expect(useAppStore.getState().currentModel).toBeNull();
  });
});
