# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within CodeAgent, please report it responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send a private report to the maintainers:

1. **Email**: Send a detailed description of the vulnerability to the repository maintainers
2. **GitHub Private Vulnerability Reporting**: Use GitHub's [private vulnerability reporting](https://github.com/zhangyu528/CodeAgent/security/advisories/new) feature

### What to Include

When reporting, please include as much of the following as possible:

- Type of vulnerability (e.g., command injection, path traversal, etc.)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment of the vulnerability

### Response Timeline

We aim to acknowledge vulnerability reports within **48 hours** and provide a more detailed response within **7 days**, including:

- Confirmation of the vulnerability
- Initial assessment and severity rating
- Expected timeline for a fix
- Credit for the report (unless you prefer to remain anonymous)

### Scope

CodeAgent is a CLI tool. Security considerations apply to:

- **Command execution**: The `run_command` tool executes shell commands. Ensure proper input validation and allowlisting.
- **File operations**: `read_file`, `write_file`, and `list_directory` tools should respect scope boundaries.
- **API keys**: Never commit API keys or secrets to the repository. Use environment variables.
- **Session storage**: Session data is stored locally. Ensure appropriate file permissions on `~/.codeagent/`.

### Security Best Practices for Users

- Never share your `~/.codeagent/` directory or session database
- Rotate API keys regularly
- Review the commands executed by CodeAgent before approving
- Use environment variables for all secrets, not hardcoded values
