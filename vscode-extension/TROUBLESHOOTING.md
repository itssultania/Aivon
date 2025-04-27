# Troubleshooting AI Assistant

This guide helps you resolve common issues with the AI Assistant extension for VS Code.

## Installation Issues

### Extension Not Showing Up

**Problem**: The extension is installed, but the AI icon doesn't appear in the activity bar.

**Solutions**:
- Reload VS Code window (Ctrl+R or Command+R on macOS)
- Check VS Code's Extensions panel to verify the extension is installed and enabled
- Ensure your VS Code version is 1.75.0 or higher
- Look for errors in the Output panel (View > Output, select "AI Assistant" from the dropdown)

### Icon Not Visible or Displaying Incorrectly

**Problem**: The AI icon is missing or appears incorrectly in the activity bar.

**Solutions**:
- Reload the VS Code window
- Check for console errors in Developer Tools (Help > Toggle Developer Tools)
- Try reinstalling the extension
- Try a different VS Code theme to see if the icon rendering is theme-dependent

## API Key Issues

### Can't Save API Key

**Problem**: Unable to save the Google Gemini API key.

**Solutions**:
- Ensure you're connected to the internet
- Check if VS Code has permission to access the system's secret storage
- Try restarting VS Code with admin/elevated privileges
- If using a remote workspace, ensure proper permissions are set

### Authentication Errors

**Problem**: Error messages about invalid API key or authorization failures.

**Solutions**:
- Verify your API key is correct (no extra spaces or characters)
- Check if your API key has expired or reached its quota
- Generate a new API key from Google AI Studio
- Ensure your system clock is correctly synchronized

## Usage Issues

### Slow or No Response

**Problem**: The assistant takes too long to respond or doesn't respond at all.

**Solutions**:
- Check your internet connection
- Reduce the context size in settings
- Add more patterns to exclude large files from the context
- Disable project context temporarily for faster responses
- Check if the Gemini API is experiencing downtime

### Poor Quality Responses

**Problem**: Responses are irrelevant, incorrect, or low quality.

**Solutions**:
- Be more specific in your queries
- Select relevant code before asking questions
- Enable project context if it's disabled
- Try rephrasing your question
- Increase the context size if it's too restrictive

### Code Application Problems

**Problem**: Suggested code changes don't apply correctly.

**Solutions**:
- Make sure the original code hasn't been modified since asking the question
- Check if there are syntax errors in the suggested code
- Try manual application if automatic application fails
- Use the checkpoint feature to revert to previous versions if needed

## Extension Panel Issues

### Panel Not Loading

**Problem**: The AI Assistant panel appears blank or doesn't load.

**Solutions**:
- Check internet connection
- Inspect the Developer Tools console for errors
- Reload the VS Code window
- Reinstall the extension

### UI Elements Missing

**Problem**: Buttons, inputs, or other UI elements are missing from the panel.

**Solutions**:
- Reload the VS Code window
- Check if VS Code is in a restricted mode
- Try a different VS Code theme
- Reinstall the extension

## Project Context Issues

### Context Settings Not Working

**Problem**: Changes to context settings don't seem to take effect.

**Solutions**:
- Reload VS Code after changing settings
- Check if settings are properly formatted in settings.json
- Verify that workspace settings aren't overriding user settings
- Ensure your file exclusion patterns are correctly formatted

### Excluded Files Still Being Included

**Problem**: Files you've excluded still appear in the context.

**Solutions**:
- Check your exclusion patterns for typos
- Use absolute paths if relative paths aren't working
- Restart VS Code after changing exclusion patterns
- Check for conflicting inclusion patterns

## Still Having Issues?

If you're still experiencing problems:

1. Check the extension's GitHub issues to see if others have reported the same problem
2. Enable logging: Add `"aiAssistant.enableLogging": true` to your VS Code settings
3. Submit an issue on our GitHub repository with:
   - Detailed description of the problem
   - Steps to reproduce the issue
   - VS Code version
   - Extension version
   - Any relevant logs or screenshots

For more help, please visit our [GitHub repository](https://github.com/yourusername/ai-assistant) or contact support. 