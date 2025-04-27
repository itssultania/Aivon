# AI Assistant Quick Start Guide

This guide will help you quickly get started with the AI Assistant extension for VS Code.

## Installation

1. Install the extension from the VS Code Marketplace or via VSIX file
2. Look for the AI icon in the activity bar (left side of VS Code)
   - The icon displays "AI" in a simple, clean design
3. Click on the icon to open the AI Assistant panel

## Setting Up Your API Key

1. When you first open the AI Assistant, you'll be prompted to enter your Google Gemini API key
2. If you don't have a key, get one from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Enter your key in the provided field and click "Save"
4. Your key is stored securely in VS Code's secret storage

## Basic Usage

### Ask Questions

1. Type your question in the input box at the bottom of the AI Assistant panel
2. Press Enter or click the Send button
3. The assistant will provide a response based on your question and the context from your project

### Code Actions

1. Select code in your editor
2. Use one of the action buttons in the AI Assistant panel:
   - **Explain**: Get a detailed explanation of the selected code
   - **Optimize**: Receive suggestions for improving your code
   - **Document**: Generate documentation comments for your code
   - **Test**: Create unit tests for the selected code

### Apply Code Changes

1. When the AI suggests code modifications, you'll see an option to apply the changes
2. Click "Apply Changes" to update your code
3. A checkpoint is automatically created, allowing you to revert if needed
4. Use the "Return to Checkpoint" button to restore previous versions of your code

## Context Settings

By default, AI Assistant includes relevant parts of your project for better responses:

- Toggle project context on/off using the checkbox in the assistant panel
- Configure context settings by clicking the gear icon (⚙️)
- Access more detailed settings through VS Code settings (search for "AI Assistant")

## Keyboard Shortcuts

- Open AI Assistant: No default shortcut (can be set in keyboard shortcuts)
- Select and Analyze Code: Ctrl+Alt+M (Cmd+Alt+M on macOS)

## Troubleshooting

If you experience issues:
- Verify your API key is valid and has not expired
- Check your internet connection
- Make sure the extension is properly installed
- Try reloading the VS Code window (Ctrl+R or Command+R)
- Check for errors in the extension console (Help > Toggle Developer Tools)

For more detailed information, refer to the [README.md](README.md) or [TROUBLESHOOTING.md](TROUBLESHOOTING.md) files. 