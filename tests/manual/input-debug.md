# Input Handling Debug Guide

## Quick Test Script

Run this to test input handling with verbose output:

```bash
cd /mnt/d/work/project/CodeAgent
npm run dev 2>&1 | tee input-test.log
```

## Manual Test Steps

### Test 1: Regular Text Input
1. Type: `hello world`
2. Press: `Enter`
3. Expected: Text submitted as prompt (or model config prompt if not set)

### Test 2: Slash Command
1. Type: `/help`
2. Press: `Enter`
3. Expected: Help message displayed

### Test 3: Slash with Navigation
1. Type: `/`
2. Use: `ArrowUp` / `ArrowDown` to navigate
3. Press: `Enter`
4. Expected: Selected command executed

## Debug Logging

To enable verbose debugging, check stderr output which contains:
- `[DEBUG InputController]` - InputController events
- `[DEBUG SlashListController]` - SlashListController events
- `[DEBUG useSafeInput]` - SafeInput hook events

## Common Issues

### Issue: Return key does nothing
Possible causes:
1. `useSafeInput` isActive is false (raw mode not supported)
2. Handler is being overridden by another component
3. Return is being captured by another component

### Issue: Slash command not recognized
Possible causes:
1. `hasSlash` check fails (input doesn't start with `/` or contains space)
2. `executeSlash` function not called
3. Command not found in SLASH_COMMANDS

## Code Flow for "/help" + Enter

```
1. User types "/help"
   → useSafeInput (InputController) receives: input="h", input="e", ...
   → setValue(prev => prev + input) called each time
   
2. User presses Enter
   → useSafeInput (InputController) receives: key.return=true
   → hasSlash = value.startsWith('/') && !value.includes(' ') = true
   → executeSlash('/help') called
   → setValue('')

3. executeSlash('/help', handlers) should:
   → Find command matching '/help'
   → Call handlers.onHelp()
   → Display help notice
```

## Check Points

Add these console.error statements to debug:

```typescript
// In InputController.ts, useSafeInput handler:
console.error('[DEBUG InputController] received:', { input, key, value, hasSlash });

// In executeSlash call:
console.error('[DEBUG] executeSlash called with:', cmd);
```
