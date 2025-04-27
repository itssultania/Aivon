# Contributing to AI Assistant for VS Code

Thank you for your interest in contributing to AI Assistant for VS Code! This document provides guidelines and instructions for contributing to this project.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   cd vscode-extension
   npm install
   ```
3. Make your changes
4. Build the extension:
   ```bash
   npm run build
   ```
5. Test your changes by pressing F5 in VS Code to launch the extension in debug mode

## Code Style and Guidelines

- Follow the TypeScript coding style present in the existing codebase
- Use meaningful variable and function names
- Write descriptive comments for complex logic
- Keep functions small and focused on a single responsibility
- Include appropriate error handling

## Pull Request Process

1. Ensure your code compiles and passes all tests
2. Update the README.md with details of changes if applicable
3. Include screenshots or GIFs for UI changes if possible
4. Submit a pull request with a clear description of the changes and any relevant issue numbers

## Commit Message Guidelines

Please use descriptive commit messages that clearly explain the changes made. Follow this format:

```
type(scope): description

[optional body]

[optional footer]
```

Types include:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Changes that don't affect code functionality (formatting, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Performance improvements
- **test**: Adding or modifying tests
- **chore**: Changes to build process or auxiliary tools

Example:
```
feat(webview): add code application checkpointing

Adds ability to create checkpoints before applying AI suggestions.
Users can revert to checkpoints if applied changes don't work as expected.

Fixes #42
```

## Feature Requests and Bug Reports

Please submit feature requests and bug reports through the GitHub Issues section. Include as much information as possible:

- For bugs: VS Code version, extension version, steps to reproduce, expected behavior, and screenshots if applicable
- For features: Clear description of the feature and the problem it solves

## Testing

- Add appropriate tests for your changes
- Ensure existing tests pass
- Test on multiple platforms if possible (Windows, macOS, Linux)
 