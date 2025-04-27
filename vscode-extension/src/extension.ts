import * as vscode from 'vscode';
import { AIAssistantProvider } from './personEditor';

export function activate(context: vscode.ExtensionContext) {
  // Register our custom webview provider
  const provider = new AIAssistantProvider(context);
  
  // Register the provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AIAssistantProvider.viewType,
      provider
    )
  );
  
  // Register a command to open the AI Assistant view
  const openViewCommand = vscode.commands.registerCommand('aiAssistant.openView', () => {
    vscode.commands.executeCommand('workbench.view.extension.ai-assistant');
  });
  
  context.subscriptions.push(openViewCommand);

  // Register the inline action command
  const inlineActionCommand = vscode.commands.registerCommand('aiAssistant.inlineAction', async () => {
    // Get active editor and selection
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showInformationMessage('Please select code in the editor first.');
      return;
    }
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    // Ask user what they want to do
    const userInstruction = await vscode.window.showInputBox({
      prompt: "What do you want to do with the selected code?",
      placeHolder: "e.g., refactor, add comments, explain, fix bugs..."
    });

    if (!userInstruction) {
      return; // User cancelled
    }

    // Combine instruction and code for the prompt
    // Use a clear separator or structure for the AI
    const prompt = `${userInstruction}:\n\n\`\`\`\n${selectedText}\n\`\`\``;

    // Show progress notification
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "AI Assistant: Processing request...",
      cancellable: false // Making it non-cancellable for simplicity, could add cancellation later
    }, async (_progress) => {
      try {
        // Call the AI (we need access to the provider's method)
        // We pass includeProjectContext=false for inline actions by default, 
        // as they are usually focused on the selection.
        const result = await provider.queryGeminiPublic(prompt, false); // Need to make a public wrapper or pass provider

        if (result && !result.startsWith('## ⚠️')) { // Check if it's not an error message
          // --- Use Diff View Instead of Direct Apply ---
          // Extract code if necessary (inline actions usually return just code, but good practice)
          const proposedCode = provider.extractCodeFromMarkdownPublic(result); // Need public wrapper
          if (proposedCode !== null) {
              await provider.showDiffAndPromptApply(editor, selection, proposedCode);
          } else {
              vscode.window.showWarningMessage('AI Assistant: Could not extract code from the response.');
          }
          // --- Old Direct Apply Logic --- 
          // await editor.edit(editBuilder => {
          //   editBuilder.replace(selection, result);
          // });
          // vscode.window.showInformationMessage('AI Assistant: Code updated.');
        } else {
          // Show error from AI result in the notification or a message box
          vscode.window.showErrorMessage(`AI Assistant Error: ${result || 'No response'}`);
        }
      } catch (error) {
        console.error("Inline action error:", error);
        vscode.window.showErrorMessage(`AI Assistant Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });
  context.subscriptions.push(inlineActionCommand);

  // Register the fix linter errors command
  const fixLinterErrorsCommand = vscode.commands.registerCommand('aiAssistant.fixLintErrors', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor found.');
      return;
    }

    const document = editor.document;
    const diagnostics = vscode.languages.getDiagnostics(document.uri);

    // Filter for relevant diagnostics (Errors and Warnings)
    const relevantDiagnostics = diagnostics.filter(
      d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning
    );

    if (relevantDiagnostics.length === 0) {
      vscode.window.showInformationMessage('No linter errors or warnings found in the current file.');
      return;
    }

    // Format diagnostics for the prompt
    const diagnosticsText = relevantDiagnostics.map(d => 
      `- Line ${d.range.start.line + 1}: [${d.source || 'lint'}] ${d.message}`
    ).join('\n');

    const fullCode = document.getText();
    const prompt = `Please fix the following linter issues in the code below:\n\n${diagnosticsText}\n\nCode:\n\`\`\`${document.languageId}\n${fullCode}\n\`\`\``;

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "AI Assistant: Attempting to fix linter errors...",
      cancellable: false
    }, async (_progress) => {
      try {
        // Call the AI - include project context as it might be helpful
        const result = await provider.queryGeminiPublic(prompt, true); 

        if (result && !result.startsWith('## ⚠️')) { 
          // Extract code from the AI response
          const fixedCode = provider.extractCodeFromMarkdownPublic(result); // Need public wrapper
          
          if (fixedCode !== null) {
            // Define the full document range
            const document = editor.document;
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.lineAt(document.lineCount - 1).range.end
            );
            const originalCode = document.getText(); // Get original full code
            
            // Show diff view for the entire file
            await provider.showDiffAndPromptApply(editor, fullRange, fixedCode);
          } else {
            vscode.window.showWarningMessage('AI Assistant: Could not extract fixed code from the response. See Output for raw response.');
            // Log the raw response if extraction failed
            console.log("--- AI Raw Response (Code Extraction Failed) ---");
            console.log(result);
            console.log("-----------------------------------------------");
          }

          // --- Old Logging Logic ---
          // console.log("--- AI Suggested Fixes ---");
          // console.log(result);
          // console.log("--------------------------");
          // vscode.window.showInformationMessage('AI Assistant generated potential fixes. Review the output console (View > Output > AI Assistant). Apply manually or wait for Diff View implementation.');
          
        } else {
          vscode.window.showErrorMessage(`AI Assistant Error: ${result || 'No response'}`);
        }
      } catch (error) {
        console.error("Fix linter errors action error:", error);
        vscode.window.showErrorMessage(`AI Assistant Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });
  context.subscriptions.push(fixLinterErrorsCommand);

  console.log('AI Assistant extension is now active!');
}

export function deactivate() {} 