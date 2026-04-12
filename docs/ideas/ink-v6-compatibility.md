# ink v6 Compatibility Report

**Generated:** 2026-04-12
**Status:** Generally Compatible — Minor Issues

## Dependency Version

```
ink: ^6.8.0 (installed: 6.8.0)
ink-scroll-view: ^0.3.6
@byteland/ink-scroll-bar: ^1.0.0
```

## ink v6 Breaking Changes from v5

### 1. `useApp` hook — Compatible
Source: ink@6.8.0 source code
- Still available in v6, used in `AppController.ts`
- No breaking changes detected

### 2. `useStdout` hook — Compatible
- Used in `AppController.ts` for terminal resize tracking
- No breaking changes in v6

### 3. `useStdin` — Behavior Changed
- In ink v6, `useStdin` returns `{ isRawModeSupported }` rather than the stdin stream directly
- **Impact:** None — project doesn't use `useStdin`

### 4. `<Text>` component — Compatible
- No breaking changes
- Used throughout UI components

### 5. `<Box>` component — Compatible
- No breaking changes

### 6. `<ScrollView>` / ink-scroll-view — Compatible
- `ink-scroll-view@0.3.6` supports ink v6
- Used in `MessageList.tsx`

## Potential Issues

### Issue 1: `onChange` Input Behavior (Low Risk)
ink v6 changed how `onChange` fires for some input types.
- **File:** `src/apps/cli/ink/components/inputs/InputField.tsx`
- **Impact:** Low — tested and works in current implementation
- **Action:** Monitor if input behavior issues appear after future ink upgrades

### Issue 2: `@byteland/ink-scroll-bar` Compatibility (Unknown)
- This is a third-party package (not maintained by ink team)
- Not verified against ink v6 API changes
- **Impact:** Unknown — works currently
- **Action:** If scroll issues appear, consider migrating to `ink-scroll-view`

## Verification

Tests pass with ink v6.8.0:
```
Test Files: 53 passed
Tests: 852 passed | 1 skipped
```

## Recommendations

1. **Add ink v6 to CI regression tests** — run ink tests on every PR
2. **Pin ink version** — consider `~6.8.0` instead of `^6.8.0` to prevent automatic major version jumps
3. **Monitor `@byteland/ink-scroll-bar`** — if maintainer doesn't update, consider migrating to `ink-scroll-view`
