import os
# Remove the diagnose test file that was created during debugging
diag_path = '/mnt/d/work/project/CodeAgent/tests/unit/agent/tools/diagnose.test.ts'
if os.path.exists(diag_path):
    os.remove(diag_path)
    print(f"Removed: {diag_path}")
else:
    print(f"Already removed: {diag_path}")
