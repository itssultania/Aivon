import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import axios from 'axios';
import * as os from "os";

export class AIAssistantProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "aiAssistant.view";
  
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _context: vscode.ExtensionContext;
  private _apiKey: string | undefined;
  private _maxFileSizeKB: number = 1000;
  private _maxProjectContextChars: number = 50000;
  private _excludePatterns: string[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
    
    // Load configuration values
    this._loadConfiguration();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('aiAssistant')) {
        this._loadConfiguration();
      }
    });
  }
  
  private _loadConfiguration() {
    const config = vscode.workspace.getConfiguration('aiAssistant');
    this._maxFileSizeKB = config.get<number>('maxFileSizeKB', 1000);
    this._maxProjectContextChars = config.get<number>('maxProjectContextChars', 50000);
    this._excludePatterns = config.get<string[]>('excludePatterns', [
      "node_modules", ".git", "dist", "build", "out", "target",
      ".vscode", ".idea", "__pycache__", ".venv", "env",
      "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.ico", "*.mp4", "*.mp3", "*.wav",
      "*.pdf", "*.zip", "*.tar", "*.gz", "*.rar"
    ]);
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new AIAssistantProvider(context);
    return vscode.window.registerWebviewViewProvider(
      AIAssistantProvider.viewType,
      provider
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "prompt":
          const response = await this._queryGemini(data.value, data.includeProjectContext);
          webviewView.webview.postMessage({ type: "response", value: response });
          break;
        
        case "saveApiKey":
          await this._setApiKey(data.value);
          webviewView.webview.postMessage({ type: "apiKeySaved" });
          break;
          
        case "getApiKey":
          const exists = await this._apiKeyExists();
          webviewView.webview.postMessage({ type: "apiKeyStatus", value: exists });
          break;
          
        case "action":
          await this._handleAction(data.value);
          break;
          
        case "contextSettings":
          await this._showContextSettings();
          break;
          
        case "applyCode":
          // Create checkpoint before applying code
          await this._createCheckpointBeforeApplying(data.messageId);
          // Apply code to editor
          await this._applyCodeToEditor(data.value || data.code, data.messageId);
          break;
          
        case "revertToCheckpoint":
          // Handle reverting to checkpoint
          await this._revertToCheckpoint(data.value);
          break;
      }
    });

    // Check if API key is already set
    this._apiKeyExists().then(exists => {
      webviewView.webview.postMessage({ type: "apiKeyStatus", value: exists });
    });
  }
  
  private async _apiKeyExists(): Promise<boolean> {
    const key = await this._getApiKey();
    return key !== undefined && key !== '';
  }

  private async _getApiKey(): Promise<string | undefined> {
    try {
      this._apiKey = await this._context.secrets.get('aiApiKey');
      return this._apiKey;
    } catch (err) {
      console.error('Failed to get API key:', err);
      return undefined;
    }
  }

  private async _setApiKey(apiKey: string): Promise<void> {
    try {
      await this._context.secrets.store('aiApiKey', apiKey);
      this._apiKey = apiKey;
    } catch (err) {
      console.error('Failed to store API key:', err);
      vscode.window.showErrorMessage('Failed to store API key securely.');
    }
  }
  
  private async _handleAction(action: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No editor is active');
      return;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showInformationMessage('Please select some code first');
      return;
    }
    
    const selectedCode = editor.document.getText(selection);
    let promptPrefix = '';
    
    switch (action) {
      case 'explain':
        promptPrefix = 'Explain this code in detail:';
        break;
      case 'optimize':
        promptPrefix = 'Optimize this code and explain your improvements:';
        break;
      case 'document':
        promptPrefix = 'Add documentation comments to this code:';
        break;
      case 'test':
        promptPrefix = 'Generate unit tests for this code:';
        break;
    }
    
    if (this._view) {
      this._view.webview.postMessage({ 
        type: 'selectedCode', 
        value: `${promptPrefix}\n\n\`\`\`\n${selectedCode}\n\`\`\``
      });
    }
  }

  // Method to apply code to editor
  private async _applyCodeToEditor(code: string, messageId?: string): Promise<void> {
    // Check if code is provided
    if (!code || typeof code !== 'string') {
      vscode.window.showErrorMessage('No valid code to apply.');
      return;
    }

    // Get active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No editor is active. Please open a file first.');
      return;
    }
    
    try {
      // Get selection or cursor position
      const selection = editor.selection;
      
      // Show confirmation dialog
      const confirmResult = await vscode.window.showInformationMessage(
        'Apply this code to the current editor?', 
        { modal: false },
        'Apply'
      );
      
      if (confirmResult !== 'Apply') {
        return; // User canceled
      }
      
      // Create workspace edit
      const workspaceEdit = new vscode.WorkspaceEdit();
      const edits = new vscode.TextEdit(
        !selection.isEmpty ? selection : new vscode.Range(selection.start, selection.start),
        code
      );
      
      // Add edit to the workspace edit
      workspaceEdit.set(editor.document.uri, [edits]);
      
      // Apply the workspace edit
      const editSuccess = await vscode.workspace.applyEdit(workspaceEdit);
      
      if (editSuccess) {
        // Format document if possible
        try {
          await vscode.commands.executeCommand('editor.action.formatDocument');
        } catch (formatError) {
          console.log('Format after edit failed, but edit was successful:', formatError);
        }
        
        vscode.window.showInformationMessage('Code applied successfully');
        
        // Update the message in webview to show it's been applied
        if (this._view && messageId) {
          this._view.webview.postMessage({
            type: 'codeApplied',
            messageId: messageId,
            fileName: vscode.workspace.asRelativePath(editor.document.fileName)
          });
        }
      } else {
        vscode.window.showErrorMessage('Failed to apply code changes');
      }
    } catch (error) {
      console.error('Error applying code:', error);
      vscode.window.showErrorMessage(`Error applying code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Public wrapper for the AI query logic to be called from commands
  public async queryGeminiPublic(prompt: string, includeProjectContext: boolean = true): Promise<string> {
    // You might want to add checks here specific to public calls if needed
    return this._queryGemini(prompt, includeProjectContext);
  }

  // Private method to handle the actual query logic
  private async _queryGemini(prompt: string, includeProjectContext: boolean = true): Promise<string> {
    const apiKey = await this._getApiKey();
    
    if (!apiKey) {
      return "Please set your Gemini API key first.";
    }

    try {
      // Get the selected text from the active editor
      let context = "";
      const editor = vscode.window.activeTextEditor;
      
      if (editor && !editor.selection.isEmpty) {
        context = editor.document.getText(editor.selection);
      }
      
      // Get project context if enabled
      let projectContext = "";
      if (includeProjectContext) {
        projectContext = await this._getProjectContext();
      }
      
      // Include the active file context if none is selected
      if (!context && editor) {
        const activeDocument = editor.document;
        context = `Active file (${path.basename(activeDocument.fileName)}):\n\`\`\`\n${activeDocument.getText()}\n\`\`\`\n`;
      }
      
      // Combine all context
      const fullContext = includeProjectContext 
        ? `${context}\n\n${projectContext}` 
        : context;
      
      // Call Gemini API directly using axios
      return await this._callGeminiApiDirectly(prompt, fullContext, apiKey);
    } catch (error) {
      console.error('Error querying Gemini:', error);
      // Provide a more specific error message if available
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `An error occurred while communicating with Gemini API: ${errorMessage}`;
    }
  }

  // New method using axios to call Gemini API
  private async _callGeminiApiDirectly(prompt: string, context: string, apiKey: string): Promise<string> {
    const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";
    const urlWithKey = `${API_URL}?key=${apiKey}`;
    
    // Combine context and prompt for the API payload
    const apiPrompt = context ? `${context}\n\n---\n\nUser Query: ${prompt}` : prompt;

    const headers = {
      "Content-Type": "application/json",
    };

    const payload = {
      contents: [
        {
          parts: [
            {
              text: apiPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        topP: 0.95,
      },
      // Add safety settings if needed
      // safetySettings: [...]
    };

    try {
      // Make the API request using axios with a timeout
      const response = await axios.post(urlWithKey, payload, {
        headers: headers,
        timeout: 30000, // 30 second timeout
      });

      // Check for successful response and valid data structure
      if (response.status === 200 && response.data) {
        const data = response.data;
        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          // Handle cases where generation was blocked
          if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            return `## ⚠️ Generation Stopped\n\nReason: ${candidate.finishReason}\n\n${candidate.safetyRatings ? 'Safety Ratings: ' + JSON.stringify(candidate.safetyRatings) : ''}`;
          }
          // Extract text content
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            return candidate.content.parts[0].text.trim();
          }
        }
        // If expected structure isn't found, return raw response for debugging
        console.warn('Unexpected Gemini API response structure:', data);
        return `Error parsing response from Gemini API. Raw response:\n${JSON.stringify(data, null, 2)}`;
      } else {
        // Handle non-200 responses
        console.error('Gemini API request failed with status:', response.status, response.statusText);
        return `## ⚠️ API Error\n\nRequest failed with status code ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      console.error('Error calling Gemini API via Axios:', error);

      let errorMsg = "An unknown error occurred.";
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMsg = "Request timed out. Please check your internet connection or try reducing context size.";
        } else if (error.response) {
          // Handle specific API error responses
          const status = error.response.status;
          const data = error.response.data;
          if (status === 400 && data?.error?.message?.includes('API key not valid')) {
            errorMsg = "Invalid API key. Please check your Gemini API key in the settings.";
          } else if (status === 401 || status === 403) {
            errorMsg = `Authorization error (${status}). Please ensure your API key is correct and has permissions.`;
          } else if (status === 429) {
            errorMsg = "Rate limit exceeded. Please wait and try again later.";
          } else {
             errorMsg = `API returned error ${status}: ${data?.error?.message || error.message}`;
          }
        } else if (error.request) {
          // Request was made but no response received
          errorMsg = "No response received from the API. Check network connectivity.";
        } else {
          // Something else happened
          errorMsg = error.message;
        }
      } else if (error instanceof Error) {
          errorMsg = error.message;
      }

      // Format error similarly to the old script output
      return `## ⚠️ API Communication Error\n\n${errorMsg}\n\n### Troubleshooting Steps\n\n1. Verify your API key is valid and has not expired\n2. Check your internet connection\n3. Try again in a few minutes`;
    }
  }
  
  /**
   * Collects relevant context from the workspace files
   */
  private async _getProjectContext(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return "No workspace folder is open.";
    }
    const workspaceRoot = workspaceFolder.uri;
    const workspaceRootPath = workspaceRoot.fsPath;

    const contextParts: string[] = [];
    let currentContextLength = 0;

    // --- 1. Active Editor Context ---
    const editor = vscode.window.activeTextEditor;
    let activeFilePath: string | undefined;
    if (editor) {
      const document = editor.document;
      // Ensure the active file is within the current workspace
      if (document.uri.fsPath.startsWith(workspaceRootPath)) {
          activeFilePath = document.uri.fsPath;
          const relPath = path.relative(workspaceRootPath, activeFilePath);
          let content = document.getText();
          let contentDesc = `Active file (${relPath}):`;

          // Handle potentially large active files (similar to open files logic)
          if (content.length > 50000) { 
              contentDesc = `Active file (partial, large file - ${relPath}):`;
              const visibleRanges = editor.visibleRanges;
              content = visibleRanges.map(range => document.getText(range)).join('\n...\n');
              const cursorPos = editor.selection.active;
              const startLine = Math.max(0, cursorPos.line - 20);
              const endLine = Math.min(document.lineCount - 1, cursorPos.line + 20);
              const cursorContext = document.getText(new vscode.Range(startLine, 0, endLine, 9999));
              content = `${content}\n\n/* Current cursor context: */\n${cursorContext}`;
          }

          const fileContext = `${contentDesc}\n\`\`\`\n${content}\n\`\`\`\n`;
          if (currentContextLength + fileContext.length <= this._maxProjectContextChars) {
              contextParts.push(fileContext);
              currentContextLength += fileContext.length;
          } else {
              // If even the active file is too big, maybe just add a truncated version or skip?
              // For now, we'll just indicate it was too large if it exceeds the total limit.
              contextParts.push(`Active file ${relPath} too large to fit within context limit.`);
          }
      }
    }

    // --- 2. Project Structure --- (Optional - keep for now)
    try {
        const fileStructure = await this._getProjectStructure(workspaceRootPath);
        const structureContext = `Project structure for ${path.basename(workspaceRootPath)}:\n${fileStructure}\n`;
        if (currentContextLength + structureContext.length <= this._maxProjectContextChars) {
            contextParts.push(structureContext);
            currentContextLength += structureContext.length;
        } else {
             contextParts.push('(Project structure omitted due to context limit)');
        }
    } catch(error) {
        console.error("Error getting project structure:", error);
        contextParts.push('(Error fetching project structure)');
    }

    // --- 3. Find Other Relevant Files --- 
    const maxRemainingChars = this._maxProjectContextChars - currentContextLength;
    if (maxRemainingChars > 100) { // Only search if there's meaningful space left
        try {
            // Define include patterns (common code & config files)
            // Adjust based on typical project types you work with
            const includePatterns = '**/{*.{js,ts,jsx,tsx,py,java,c,cpp,cs,go,rb,php,swift,kt,rs,html,css,scss,vue,json,xml,yaml,yml,md,sh,cfg,ini,toml},README*,Dockerfile,Makefile,package.json,tsconfig.json,requirements.txt,pyproject.toml,pom.xml,build.gradle,Cargo.toml,Gemfile,composer.json}';
            
            // Construct exclude patterns based on settings and common ignores
            const excludeGlobs = vscode.workspace.getConfiguration('files').get<Record<string, boolean>>('exclude', {});
            const excludePatterns = Object.entries(excludeGlobs)
                .filter(([, value]) => value)
                .map(([key]) => `**/${key}/**`); // Ensure it matches subdirectories
            
            // Combine with user-defined exclusions
            this._excludePatterns.forEach(p => excludePatterns.push(p.includes('/') ? p : `**/${p}/**`)); 
            
            const excludePatternString = `{${excludePatterns.join(',')}}`;

            const potentialFiles = await vscode.workspace.findFiles(includePatterns, excludePatternString, 100); // Limit results

            // Prioritize certain file types
            const filePriority = ['README', 'package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'Cargo.toml', 'composer.json'];
            potentialFiles.sort((a, b) => {
                const aName = path.basename(a.fsPath).toLowerCase();
                const bName = path.basename(b.fsPath).toLowerCase();
                const aPrio = filePriority.findIndex(p => aName.startsWith(p.toLowerCase()));
                const bPrio = filePriority.findIndex(p => bName.startsWith(p.toLowerCase()));
                
                if (aPrio !== -1 && bPrio !== -1) return aPrio - bPrio; // Both have priority
                if (aPrio !== -1) return -1; // a has priority
                if (bPrio !== -1) return 1;  // b has priority
                return a.fsPath.localeCompare(b.fsPath); // Otherwise alphabetical
            });

            for (const fileUri of potentialFiles) {
                // Skip active file if already added
                if (fileUri.fsPath === activeFilePath) {
                    continue;
                }

                try {
                    const stats = fs.statSync(fileUri.fsPath); // Use statSync for simplicity here, but async preferred for many files
                    if (stats.size > this._maxFileSizeKB * 1024 || stats.size === 0) {
                        continue; // Skip large or empty files
                    }

                    const content = fs.readFileSync(fileUri.fsPath, 'utf8');
                    const relPath = path.relative(workspaceRootPath, fileUri.fsPath);
                    const fileContext = `File: ${relPath}\n\`\`\`\n${content}\n\`\`\`\n`;

                    if (currentContextLength + fileContext.length <= this._maxProjectContextChars) {
                        contextParts.push(fileContext);
                        currentContextLength += fileContext.length;
                    } else {
                        // Stop adding files once limit is reached
                        contextParts.push('\n(Additional files omitted due to context limit)');
                        break; 
                    }
                } catch (readError) {
                    console.warn(`Error reading file ${fileUri.fsPath}:`, readError);
                }
            }

        } catch (findError) {
            console.error("Error finding files for context:", findError);
            contextParts.push('(Error searching for project files)');
        }
    }

    return contextParts.join('\n\n');
  }
  
  /**
   * Gets a simplified project structure (directories and files)
   */
  private async _getProjectStructure(rootPath: string, depth: number = 3): Promise<string> {
    const result: string[] = [];
    
    const processDirectory = async (dirPath: string, currentDepth: number, prefix: string) => {
      if (currentDepth > depth) return;
      
      try {
        const entries = fs.readdirSync(dirPath);
        const dirs: string[] = [];
        const files: string[] = [];
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const relativePath = path.relative(rootPath, fullPath);
          
          // Skip excluded paths
          if (this._shouldExclude(relativePath)) {
            continue;
          }
          
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              dirs.push(entry);
            } else if (stat.isFile()) {
              files.push(entry);
            }
          } catch (err) {
            // Skip files/dirs we can't access
            continue;
          }
        }
        
        // Sort directories and files
        dirs.sort();
        files.sort();
        
        // Process directories first
        for (let i = 0; i < dirs.length; i++) {
          const isLast = i === dirs.length - 1 && files.length === 0;
          const dirPrefix = isLast ? '└── ' : '├── ';
          const dirEntry = dirs[i];
          result.push(`${prefix}${dirPrefix}${dirEntry}/`);
          
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          await processDirectory(path.join(dirPath, dirEntry), currentDepth + 1, newPrefix);
        }
        
        // Then process files
        for (let i = 0; i < files.length; i++) {
          const isLast = i === files.length - 1;
          const filePrefix = isLast ? '└── ' : '├── ';
          result.push(`${prefix}${filePrefix}${files[i]}`);
        }
      } catch (err) {
        result.push(`${prefix}Error reading directory: ${err}`);
      }
    };
    
    result.push(`\`\`\`
${path.basename(rootPath)}/`);
    await processDirectory(rootPath, 1, '');
    result.push('```');
    
    return result.join('\n');
  }
  
  /**
   * Checks if a path should be excluded from processing
   */
  private _shouldExclude(relativePath: string): boolean {
    return this._excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to main script and convert to webview uri
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js")
    );

    // Get the local path to css and convert to webview uri
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "styles.css")
    );
    
    // Get URIs for local highlight.js files
    const highlightScriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media", "highlight.min.js")
    );
    const highlightStyleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "media", "highlight.vs2015.min.css")
    );

    const nonce = this._getNonce();

    // Add custom scrolling helper script
    const scrollHelperScript = `
        document.addEventListener('DOMContentLoaded', function() {
            const conversationContainer = document.getElementById('conversationContainer');
            
            // Store file checkpoints for reverting changes
            let fileCheckpoints = [];
            let messageCounter = 0;
            
            // Basic function to hide welcome message
            function hideWelcomeMessage() {
                const welcomeMessage = document.querySelector('.welcome-message');
                if (welcomeMessage) {
                    welcomeMessage.style.display = 'none';
                }
            }
            
            // Function to create a checkpoint of current file state
            function createFileCheckpoint(fileContent, fileName) {
                const timestamp = new Date().toISOString();
                const checkpoint = {
                    file: fileName,
                    content: fileContent,
                    timestamp: timestamp,
                    id: 'checkpoint-' + Date.now()
                };
                
                fileCheckpoints.push(checkpoint);
                return checkpoint.id;
            }
            
            // Function to add "Return to Checkpoint" button to user messages
            function addCheckpointButton(messageElement, checkpointId) {
                if (!messageElement || !checkpointId) return;
                
                // Create actions container if it doesn't exist
                let actionsContainer = messageElement.querySelector('.message-actions');
                if (!actionsContainer) {
                    actionsContainer = document.createElement('div');
                    actionsContainer.className = 'message-actions';
                    messageElement.appendChild(actionsContainer);
                }
                
                // Check if button already exists
                if (actionsContainer.querySelector('.checkpoint-button')) {
                    return; // Button already exists
                }
                
                // Create checkpoint button
                const checkpointButton = document.createElement('button');
                checkpointButton.className = 'message-action-button checkpoint-button';
                checkpointButton.innerHTML = '<span class="icon">↺</span> Return to Checkpoint';
                checkpointButton.setAttribute('data-checkpoint-id', checkpointId);
                
                // Add click handler
                checkpointButton.addEventListener('click', function() {
                    revertToCheckpoint(checkpointId);
                });
                
                actionsContainer.appendChild(checkpointButton);
                actionsContainer.style.opacity = '1'; // Make it immediately visible for testing
            }
            
            // Function to revert to a checkpoint
            function revertToCheckpoint(checkpointId) {
                const checkpoint = fileCheckpoints.find(cp => cp.id === checkpointId);
                if (!checkpoint) return;
                
                // Send message to extension to revert the file
                window.parent.postMessage({
                    type: 'revertToCheckpoint',
                    value: checkpoint
                }, '*');
                
                // Show feedback to user
                const feedbackElement = document.createElement('div');
                feedbackElement.className = 'message system-message';
                feedbackElement.innerHTML = \`
                    <div class="message-content">
                        <p>Reverting file <strong>\${checkpoint.file}</strong> to checkpoint state.</p>
                    </div>
                \`;
                
                conversationContainer.appendChild(feedbackElement);
                
                // Ensure scrolling works properly
                setupScrolling();
                
                // Scroll to the feedback message
                setTimeout(() => {
                    feedbackElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
            
            // Create a temporary test checkpoint for debugging
            function createTestCheckpoint() {
                // Find all assistant messages with code blocks
                const assistantMessages = document.querySelectorAll('.assistant-message');
                
                assistantMessages.forEach((message, index) => {
                    // Ensure the message has an ID
                    if (!message.id) {
                        message.id = 'msg-' + (Date.now() + index);
                    }
                    
                    // Create a test checkpoint
                    const checkpointId = createFileCheckpoint("// Test file content for checkpoint debugging", "test-file-" + index + ".js");
                    
                    // Add checkpoint button to this message
                    addCheckpointButton(message, checkpointId);
                    
                    console.log("Added test checkpoint button to message", message.id);
                });
            }
            
            // Handle when code is applied
            function handleCodeApplied(messageId, fileName) {
                // Create a real checkpoint (this should ideally have the actual file content)
                const checkpointId = createFileCheckpoint("// Real file content would be here", fileName);
                
                // Find the message element
                const messageElement = document.getElementById(messageId);
                if (messageElement) {
                    addCheckpointButton(messageElement, checkpointId);
                    console.log("Added real checkpoint button to message", messageId);
                } else {
                    console.warn("Message element not found for ID:", messageId);
                }
            }
            
            // Ensure scrolling works properly
            function setupScrolling() {
                if (!conversationContainer) return;
                
                // Set proper scrolling
                conversationContainer.style.overflowY = 'auto';
                
                // Add scroll event listener for future enhancements
                conversationContainer.addEventListener('scroll', function() {
                    // This can be used later for scroll position tracking if needed
                });
            }
            
            // Create or get message ID 
            function getMessageId() {
                return 'msg-' + (Date.now() + messageCounter++);
            }
            
            // Run initial setup
            setupScrolling();
            
            // FOR TESTING - add checkpoint buttons to existing messages
            setTimeout(() => {
                createTestCheckpoint();
            }, 1000);
            
            // Listen for checkpoint creation requests from the extension
            window.addEventListener('message', function(event) {
                const message = event.data;
                
                if (message && message.type === 'createCheckpoint') {
                    const checkpointId = createFileCheckpoint(message.fileContent, message.fileName);
                    
                    // Add return to checkpoint button to the message
                    if (message.messageId) {
                        const messageElement = document.getElementById(message.messageId);
                        if (messageElement) {
                            addCheckpointButton(messageElement, checkpointId);
                            console.log("Added checkpoint button via createCheckpoint event");
                        } else {
                            console.warn("Message element not found for createCheckpoint:", message.messageId);
                        }
                    }
                } else if (message && message.type === 'codeApplied') {
                    handleCodeApplied(message.messageId, message.fileName);
                    console.log("Received codeApplied event", message);
                }
            });
            
            // Add window resize handler to maintain scrolling on resize
            window.addEventListener('resize', function() {
                if (conversationContainer) {
                    setupScrolling();
                }
            });
        });
    `;

    // Add custom message template to the HTML
    const messageTemplate = `
        <div class="message {{type}}" id="{{messageId}}">
            <div class="message-content">{{content}}</div>
            <div class="message-actions"></div>
        </div>
    `;
    
    // Update HTML to include the message template
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <link rel="stylesheet" type="text/css" href="${styleUri}">
        <link rel="stylesheet" href="${highlightStyleUri}">
        <title>AI Assistant</title>
    </head>
    <body>
        <div class="container">
            <!-- API Key Setup Screen -->
            <div id="apiKeyContainer">
                <div class="api-key-setup">
                    <h2>AI Assistant</h2>
                    <p>Please provide your Google API key to use the assistant. It will be stored securely in your VSCode settings.</p>
                    <div class="input-group">
                        <input type="password" id="apiKeyInput" placeholder="Enter your Google API key">
                        <button id="saveApiKeyBtn">Save</button>
                    </div>
                    <p class="subtle-text">Don't have an API key? <a href="https://makersuite.google.com/app/apikey" target="_blank">Get one here</a></p>
                </div>
            </div>
            
            <!-- Main Chat Interface -->
            <div id="assistantContainer">
                <!-- Header with controls -->
                <div class="chat-header">
                    <div class="header-controls">
                        <button id="newChatBtn" title="New Conversation" class="icon-button">
                            <span class="icon">New</span> 
                        </button>
                        <button id="contextSettingsBtn" title="Context Settings" class="icon-button">
                            <span class="icon">Settings</span>
                        </button>
                    </div>
                </div>
                
                <!-- Code Action Toolbar -->
                <div class="action-toolbar">
                    <div class="action-buttons">
                        <button class="action-button" data-action="explain">Explain</button>
                        <button class="action-button" data-action="optimize">Optimize</button>
                        <button class="action-button" data-action="document">Document</button>
                        <button class="action-button" data-action="test">Test</button>
                    </div>
                    
                    <div class="context-toggle">
                        <label class="toggle-label">
                            <input type="checkbox" id="includeProjectContext" checked>
                            <span class="toggle-text">Project Context</span>
                        </label>
                        <div class="toggle-info">
                            <span class="tooltip">Includes relevant files</span>
                        </div>
                    </div>
                </div>
                
                <!-- Conversation Area with scrollbar -->
                <div class="conversation-wrapper">
                    <div id="conversationContainer">
                        <!-- Welcome message -->
                        <div class="message system-message welcome-message">
                            <div class="message-content">
                                <p>Welcome to AI Assistant. Ask questions about your code or use the action buttons when you select code.</p>
                            </div>
                        </div>
                        <!-- Messages will be added here by JavaScript -->
                    </div>
                </div>
                
                <!-- Input Area -->
                <div class="prompt-container">
                    <textarea id="promptInput" placeholder="Ask about your code..." rows="1"></textarea>
                    <div class="prompt-actions">
                        <button id="sendBtn" class="send-button">
                            <span class="send-icon">→</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
        <script nonce="${nonce}" src="${highlightScriptUri}"></script>
        <script nonce="${nonce}">
        // Add the message template to the window object
        window.messageTemplate = \`${messageTemplate}\`;
        ${scrollHelperScript}
        </script>
    </body>
    </html>`;
  }

  private _getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private async _showContextSettings(): Promise<void> {
    // Show a quick pick for configuring context settings
    const options = [
      {
        label: "Max File Size (KB)",
        description: `Current: ${this._maxFileSizeKB}KB`,
        value: "fileSize"
      },
      {
        label: "Max Total Context Size (chars)",
        description: `Current: ${this._maxProjectContextChars} characters`,
        value: "contextSize"
      },
      {
        label: "Edit Exclusion Patterns",
        description: "Configure which files/folders to exclude",
        value: "exclusions"
      }
    ];
    
    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "Choose a setting to configure"
    });
    
    if (!selected) return;
    
    switch (selected.value) {
      case "fileSize":
        const fileSizeInput = await vscode.window.showInputBox({
          prompt: "Enter maximum file size in KB",
          value: this._maxFileSizeKB.toString(),
          validateInput: (input) => {
            const num = Number(input);
            return (!isNaN(num) && num > 0) ? null : "Please enter a positive number";
          }
        });
        
        if (fileSizeInput) {
          this._maxFileSizeKB = Number(fileSizeInput);
        }
        break;
        
      case "contextSize":
        const contextSizeInput = await vscode.window.showInputBox({
          prompt: "Enter maximum context size in characters",
          value: this._maxProjectContextChars.toString(),
          validateInput: (input) => {
            const num = Number(input);
            return (!isNaN(num) && num > 0) ? null : "Please enter a positive number";
          }
        });
        
        if (contextSizeInput) {
          this._maxProjectContextChars = Number(contextSizeInput);
        }
        break;
        
      case "exclusions":
        // For now show the current exclusions and allow adding/removing simple patterns
        const currentExclusions = this._excludePatterns.join(", ");
        const exclusionsInput = await vscode.window.showInputBox({
          prompt: "Enter exclusion patterns (comma-separated)",
          value: currentExclusions,
          validateInput: (input) => {
            return input.trim() ? null : "Please enter at least one pattern";
          }
        });
        
        if (exclusionsInput) {
          this._excludePatterns = exclusionsInput
            .split(",")
            .map(pattern => pattern.trim())
            .filter(pattern => pattern.length > 0);
        }
        break;
    }
  }

  // Public wrapper for code extraction
  public extractCodeFromMarkdownPublic(markdown: string): string | null {
    return this._extractCodeFromMarkdown(markdown);
  }
  
  // Helper function to extract code from markdown block
  private _extractCodeFromMarkdown(markdown: string): string | null {
    const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
    const match = markdown.match(codeBlockRegex);
    return match ? match[1].trim() : markdown.trim(); // Return trimmed content or the original if no block found
  }

  // Helper function to show diff and prompt for applying changes
  public async showDiffAndPromptApply(
    editor: vscode.TextEditor,
    originalRange: vscode.Range, 
    proposedContent: string
  ): Promise<void> {
    const document = editor.document;
    const originalContent = document.getText(originalRange);
    
    // If proposed content is identical to original, no need for diff
    if (originalContent === proposedContent) {
      vscode.window.showInformationMessage("AI proposed no changes.");
      return;
    }

    let tempDir: string | undefined;
    let originalUri: vscode.Uri | undefined;
    let modifiedUri: vscode.Uri | undefined;

    try {
      // Create temporary directory
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aiedit-'));

      // Determine file extension
      const langId = document.languageId;
      const fileExtension = this._getExtensionForLanguageId(langId);

      // Create temporary files
      const originalFileName = `original${fileExtension}`;
      const modifiedFileName = `modified${fileExtension}`;
      originalUri = vscode.Uri.file(path.join(tempDir, originalFileName));
      modifiedUri = vscode.Uri.file(path.join(tempDir, modifiedFileName));

      // Write content to temporary files
      await vscode.workspace.fs.writeFile(originalUri, Buffer.from(originalContent, 'utf8'));
      await vscode.workspace.fs.writeFile(modifiedUri, Buffer.from(proposedContent, 'utf8'));

      // Show diff editor
      const diffTitle = `AI Proposed Changes for ${path.basename(document.fileName)}`;
      await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, diffTitle);

      // Prompt user to apply changes
      const selection = await vscode.window.showInformationMessage(
        'Apply the proposed changes shown in the diff editor?',
        'Apply Changes',
        'Discard'
      );

      if (selection === 'Apply Changes') {
        // Apply the changes to the original editor
        await editor.edit(editBuilder => {
          editBuilder.replace(originalRange, proposedContent);
        });
        vscode.window.showInformationMessage('Changes applied.');
      } else {
        vscode.window.showInformationMessage('Changes discarded.');
      }
    } catch (error) {
      console.error("Error showing diff or applying changes:", error);
      vscode.window.showErrorMessage(`Failed to show diff or apply changes: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up temporary files and directory
      if (tempDir) {
        try {
          // Ensure files are closed before deleting - might not be strictly necessary with fs.rm
          // We might need to check if the diff editor is still open?
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn("Failed to clean up temporary diff files:", cleanupError);
        }
      }
    }
  }

  // Helper to get a file extension for syntax highlighting in diff
  private _getExtensionForLanguageId(languageId: string): string {
    // Basic mapping, expand as needed
    const map: { [key: string]: string } = {
      'javascript': '.js',
      'typescript': '.ts',
      'javascriptreact': '.jsx',
      'typescriptreact': '.tsx',
      'python': '.py',
      'java': '.java',
      'csharp': '.cs',
      'c': '.c',
      'cpp': '.cpp',
      'html': '.html',
      'css': '.css',
      'json': '.json',
      'markdown': '.md',
      'shellscript': '.sh',
      'yaml': '.yaml',
      // Add more mappings
    };
    return map[languageId] || '.txt'; // Default to .txt
  }

  // Create a checkpoint of the current file state before applying changes
  private async _createCheckpointBeforeApplying(messageId?: string): Promise<void> {
    try {
      // Get active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        console.log("No active editor for creating checkpoint");
        return;
      }

      // Get document content and file path
      const document = editor.document;
      const fileName = document.fileName;
      const fileContent = document.getText();
      
      // Send message to webview to create checkpoint
      if (this._view) {
        this._view.webview.postMessage({
          type: 'createCheckpoint',
          fileName: vscode.workspace.asRelativePath(fileName),
          fileContent: fileContent,
          messageId: messageId
        });
      }
      
      console.log(`Created checkpoint for file: ${fileName}`);
    } catch (error) {
      console.error("Error creating checkpoint:", error);
    }
  }

  // Revert to a previous checkpoint
  private async _revertToCheckpoint(checkpoint: any): Promise<void> {
    if (!checkpoint || !checkpoint.file || !checkpoint.content) {
      vscode.window.showErrorMessage("Invalid checkpoint information for reverting");
      return;
    }
    
    try {
      // Find the file
      let targetUri: vscode.Uri | undefined;
      
      // Check if it's a relative or absolute path
      if (path.isAbsolute(checkpoint.file)) {
        targetUri = vscode.Uri.file(checkpoint.file);
      } else {
        // Try to find the file in the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
          for (const folder of workspaceFolders) {
            const possibleUri = vscode.Uri.joinPath(folder.uri, checkpoint.file);
            try {
              await vscode.workspace.fs.stat(possibleUri);
              targetUri = possibleUri;
              break;
            } catch {
              // File doesn't exist in this folder, continue to the next
            }
          }
        }
      }
      
      if (!targetUri) {
        vscode.window.showErrorMessage(`Couldn't find file ${checkpoint.file} to revert`);
        return;
      }
      
      // Create a workspace edit
      const workspaceEdit = new vscode.WorkspaceEdit();
      
      // Get current document content
      try {
        const document = await vscode.workspace.openTextDocument(targetUri);
        
        // Create full document range
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        
        // Set the edit to replace entire file content
        workspaceEdit.replace(targetUri, fullRange, checkpoint.content);
      } catch (error) {
        console.error("Error opening document:", error);
        vscode.window.showErrorMessage(`Error opening document: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      
      // Apply the edit
      const success = await vscode.workspace.applyEdit(workspaceEdit);
      
      if (success) {
        vscode.window.showInformationMessage(`Successfully reverted ${checkpoint.file} to checkpoint`);
        
        // Open the file if it isn't already
        const document = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(document);
        
        // Format document if possible
        try {
          await vscode.commands.executeCommand('editor.action.formatDocument');
        } catch (formatError) {
          console.log('Format after revert failed, but revert was successful:', formatError);
        }
      } else {
        vscode.window.showErrorMessage(`Failed to revert ${checkpoint.file} to checkpoint`);
      }
    } catch (error) {
      console.error("Error reverting to checkpoint:", error);
      vscode.window.showErrorMessage(`Error reverting to checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 