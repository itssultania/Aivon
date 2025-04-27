# Requirements for AI Assistant VS Code Extension

This document outlines all requirements needed to develop and run the AI Assistant VS Code extension.

## Development Requirements

### Software Requirements

- **Node.js**: v16.x or later
- **npm**: v8.x or later
- **Visual Studio Code**: v1.75.0 or later
- **Git**: Any recent version

### VS Code Extension Development Requirements

The following VS Code extension development tools are required:

- **vscode Extension API Types**: For VS Code extension development
- **ESLint**: For code linting
- **TypeScript**: For type checking and compilation
- **esbuild**: For bundling the extension

### Runtime Dependencies

The extension has the following runtime dependencies:

- **axios**: HTTP client for making API requests to Google's Gemini API

## Installation Instructions

1. Install Node.js (which includes npm) from [nodejs.org](https://nodejs.org/)
2. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-assistant.git
   ```
3. Install dependencies:
   ```
   cd ai-assistant/vscode-extension
   npm install
   ```

All required development dependencies are listed in the `package.json` file and will be installed automatically when running `npm install`.

## Building the Extension

To build the extension:

```
npm run build
```

For production builds:

```
npm run build-prod
```

## Packaging the Extension

To package the extension into a `.vsix` file:

```
npm run package
```

## API Key Requirements

A Google Gemini API key is required to use the extension. You can obtain one from [Google AI Studio](https://makersuite.google.com/app/apikey).

## VS Code Version Compatibility

This extension requires VS Code version 1.75.0 or higher due to API dependencies. 