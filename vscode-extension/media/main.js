(function () {
    // Get a reference to the VS Code API
    const vscode = acquireVsCodeApi();

    // DOM elements
    const apiKeyContainer = document.getElementById('apiKeyContainer');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const assistantContainer = document.getElementById('assistantContainer');
    const conversationContainer = document.getElementById('conversationContainer');
    const promptInput = document.getElementById('promptInput');
    const includeProjectContext = document.getElementById('includeProjectContext');
    const contextSettingsBtn = document.getElementById('contextSettingsBtn');
    const newChatBtn = document.getElementById('newChatBtn');

    // State
    let apiKey = '';
    let conversationHistory = [];
    let isLoading = false;

    // Initialize the extension
    function init() {
        // Check if API key is already stored
        vscode.postMessage({ type: 'getApiKey' });
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'apiKeyStatus':
                    handleApiKeyStatus(message.value);
                    break;
                case 'response':
                    handleAssistantResponse(message.value);
                    break;
                case 'selectedCode':
                    handleSelectedCode(message.value);
                    break;
                case 'error':
                    showError(message.value);
                    break;
                case 'apiKeySaved':
                    showSuccess('API key saved successfully');
                    break;
                case 'codeDiff':
                    handleCodeDiff(message.value);
                    break;
            }
        });
        
        // Setup event listeners
        setupEventListeners();
        setupCodeBlockHandlers();
        
        // Auto-resize textarea
        setupAutoResizeTextarea();
        
        // Setup scrolling behavior
        setupScrollBehavior();
    }

    // Set up event listeners
    function setupEventListeners() {
        // Send prompt when button is clicked
        document.getElementById('sendBtn').addEventListener('click', () => {
            handleSubmit();
        });
        
        // Send prompt when Enter is pressed (without Shift)
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        });
        
        // Save API key
        saveApiKeyBtn.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                showError('Please enter a valid API key');
                return;
            }
            
            vscode.postMessage({
                type: 'saveApiKey',
                value: apiKey
            });
        });
        
        // Context settings button
        contextSettingsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'contextSettings' });
        });
        
        // New chat button
        newChatBtn.addEventListener('click', startNewChat);

        // Action buttons
        document.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                vscode.postMessage({ type: 'action', value: action });
            });
        });
    }

    // Handle form submission
    function handleSubmit() {
        const prompt = promptInput.value.trim();
        
        if (!prompt || isLoading) return;
        
        // Add user message
        addUserMessage(prompt);
        
        // Show loading indicator
        showLoadingIndicator();
        
        // Send to extension
        vscode.postMessage({
            type: 'prompt',
            value: prompt,
            includeProjectContext: includeProjectContext.checked,
            history: conversationHistory
        });
        
        // Clear input and reset height
        promptInput.value = '';
        promptInput.style.height = 'auto';
        
        // Focus back on input
        promptInput.focus();
    }

    // Auto-resize textarea
    function setupAutoResizeTextarea() {
        promptInput.setAttribute('style', 'height: auto;');
        promptInput.addEventListener('input', () => {
            promptInput.style.height = 'auto';
            promptInput.style.height = (promptInput.scrollHeight) + 'px';
        });
    }

    // Handle API key status
    function handleApiKeyStatus(hasKey) {
        if (hasKey) {
            apiKeyContainer.style.display = 'none';
            assistantContainer.style.display = 'flex';
        } else {
            apiKeyContainer.style.display = 'flex';
            assistantContainer.style.display = 'none';
        }
    }

    // Add user message
    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Split text by line breaks and create paragraphs
        const paragraphs = text.split('\n').filter(line => line.trim() !== '');
        paragraphs.forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            content.appendChild(p);
        });
        
        messageDiv.appendChild(content);
        conversationContainer.appendChild(messageDiv);
        
        // Save to conversation history
        conversationHistory.push({ role: 'user', content: text });
        
        // Use better scrolling
        window.requestAnimationFrame(scrollToBottom);
    }

    // Handle assistant response
    function handleAssistantResponse(response) {
        hideLoadingIndicator();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Check if this is an error message
        const isErrorMessage = response.includes('## ⚠️ API Error') || 
                             response.includes('## ⚠️ Error Running Gemini');
        
        if (isErrorMessage) {
            messageDiv.className = 'message error-message';
        }
        
        // Parse code blocks and format message
        const { formattedText, codeBlocks } = parseCodeBlocks(response);
        content.innerHTML = formattedText;
        
        messageDiv.appendChild(content);
        conversationContainer.appendChild(messageDiv);
        
        // Add code blocks if any
        if (codeBlocks.length > 0) {
            codeBlocks.forEach(block => {
                const placeholder = content.querySelector(`#${block.id}`);
                if (placeholder) {
                    // Replace placeholder with code block
                    const codeBlockElement = createCodeBlockElement(block);
                    placeholder.replaceWith(codeBlockElement);
                } else {
                    // If placeholder not found, append to the message
                    content.appendChild(createCodeBlockElement(block));
                }
            });
            
            // Force redraw to ensure proper layout
            void conversationContainer.offsetHeight;
        }
        
        // Save to conversation history
        conversationHistory.push({ role: 'assistant', content: response });
        
        // Ensure scrolling works correctly - with a small delay to let content render
        window.requestAnimationFrame(() => {
            scrollToBottom();
            
            // Also add a second delayed scroll to ensure everything is visible
            setTimeout(scrollToBottom, 300);
        });
    }

    // Parse code blocks from markdown
    function parseCodeBlocks(text) {
        const codeBlocks = [];
        let formattedText = text;
        
        // Match code blocks with language specification
        const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
        let match;
        let index = 0;
        
        while ((match = codeBlockRegex.exec(text)) !== null) {
            const language = match[1];
            let code = match[2].trim();
            const id = `code-${Date.now()}-${index++}`;
            
            // Check if this looks like a patch (contains special markers)
            const isPatch = code.includes('// ... existing code ...') || 
                           code.includes('/* ... existing code ... */') ||
                           code.includes('# ... existing code ...') ||
                           code.includes('<!-- ... existing code ... -->');
            
            // Check if the code is a file path reference format - something like file_path:10:20 at the start
            const filePathMatch = code.match(/^([a-zA-Z0-9_\-./\\]+):(\d+):(\d+)/);
            if (filePathMatch) {
                // This is a file path reference - mark it for the user
                const filePath = filePathMatch[1];
                const startLine = filePathMatch[2];
                const endLine = filePathMatch[3];
                
                // Remove the path line and add a comment about incremental edits
                code = code.substring(code.indexOf('\n') + 1);
                
                // Add a hint about how to do incremental edits if this doesn't already have patch markers
                if (!isPatch) {
                    const commentPrefix = language === 'html' ? '<!-- ' : 
                                         (language === 'python' || language === 'ruby' || language === 'bash' ? '# ' : '// ');
                    const commentSuffix = language === 'html' ? ' -->' : '';
                    
                    code = `${commentPrefix}File: ${filePath} (Lines ${startLine}-${endLine})${commentSuffix}\n${commentPrefix}Use "${commentPrefix}... existing code ...${commentSuffix}" to preserve unchanged parts${commentSuffix}\n\n${code}`;
                }
            }
            
            codeBlocks.push({ language, code, id, isPatch });
            
            // Replace code block with placeholder
            formattedText = formattedText.replace(match[0], `<div id="${id}"></div>`);
        }
        
        // Convert remaining markdown to HTML
        formattedText = formatMarkdown(formattedText);
        
        return { formattedText, codeBlocks };
    }

    // Create code block element
    function createCodeBlockElement({ language, code, id, isPatch }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.id = id;
        
        const header = document.createElement('div');
        header.className = 'code-block-header';
        
        const langName = document.createElement('span');
        langName.className = 'language-name';
        langName.textContent = language.toUpperCase();
        
        // Add a tooltip with usage information
        langName.setAttribute('title', `Code in ${language.toUpperCase()} format`);
        
        const actions = document.createElement('div');
        actions.className = 'code-block-actions';
        
        // Preview button for patches
        if (isPatch) {
            const previewBtn = document.createElement('button');
            previewBtn.className = 'preview-button';
            previewBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Preview';
            previewBtn.setAttribute('title', 'Preview what will change');
            previewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                previewCodeChanges(code);
            });
            actions.appendChild(previewBtn);
        }
        
        // Add guide link if this could be a partial code edit
        if (code.length > 50 && !isPatch) {
            const helpLink = document.createElement('button');
            helpLink.className = 'help-button';
            helpLink.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            helpLink.setAttribute('title', 'Use "// ... existing code ..." comments to mark unchanged sections');
            helpLink.addEventListener('click', (e) => {
                e.stopPropagation();
                showSuccess('Tip: Use "// ... existing code ..." comments to mark unchanged sections when applying code.', true);
            });
            actions.appendChild(helpLink);
        }
        
        const applyBtn = document.createElement('button');
        applyBtn.className = 'apply-code-button';
        applyBtn.textContent = 'Apply';
        applyBtn.setAttribute('title', 'Apply this code to the editor (use "// ... existing code ..." to mark unchanged sections)');
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button';
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
        copyBtn.setAttribute('title', 'Copy code to clipboard');
        
        actions.appendChild(applyBtn);
        actions.appendChild(copyBtn);
        
        header.appendChild(langName);
        header.appendChild(actions);
        
        const pre = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.className = `language-${language}`;
        codeElement.textContent = code;
        
        pre.appendChild(codeElement);
        
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
        
        // Adjust max height based on code length
        if (code.split('\n').length > 20) {
            pre.style.height = 'calc(60vh - 40px)';
        }
        
        // Set up event handlers directly
        applyBtn.addEventListener('click', () => handleApplyCode(code));
        copyBtn.addEventListener('click', () => handleCopyCode(code));
        
        // Highlight code if highlight.js is available
        if (typeof hljs !== 'undefined') {
            try {
                hljs.highlightElement(codeElement);
            } catch (e) {
                console.error('Failed to highlight code:', e);
            }
        }
        
        return wrapper;
    }

    // Handle code block actions
    function setupCodeBlockHandlers() {
        // Copy code
        document.addEventListener('click', (e) => {
            if (e.target.closest('.copy-button')) {
                const codeBlock = e.target.closest('.code-block-wrapper');
                const code = codeBlock.querySelector('code').textContent;
                handleCopyCode(code);
            }
        });
        
        // Apply code
        document.addEventListener('click', (e) => {
            if (e.target.closest('.apply-code-button')) {
                const codeBlock = e.target.closest('.code-block-wrapper');
                const code = codeBlock.querySelector('code').textContent;
                handleApplyCode(code);
            }
        });
    }

    // Copy code to clipboard
    function handleCopyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            showSuccess('Code copied to clipboard');
        }).catch(() => {
            showError('Failed to copy code');
        });
    }

    // Apply code to editor
    function handleApplyCode(code) {
        // Check if code is valid
        if (!code || typeof code !== 'string' || code.trim() === '') {
            showError('Cannot apply empty code.');
            return;
        }

        // Show a temporary message that code is being applied
        const applyingMessage = showSuccess('Applying code to editor...', true);
        
        // Determine if this is a patch or full replacement
        // Look for special patch markers like "// ... existing code ..."
        const hasPatchMarkers = code.includes('// ... existing code ...') || 
                              code.includes('/* ... existing code ... */') ||
                              code.includes('# ... existing code ...') ||
                              code.includes('<!-- ... existing code ... -->');
        
        // Prepare additional metadata for the extension
        const metadata = {
            isPatch: hasPatchMarkers,
            timestamp: Date.now()
        };
        
        // Log for debugging
        console.log(`Applying code as ${hasPatchMarkers ? 'patch' : 'full replacement'}:`, 
                    code.substring(0, 100) + (code.length > 100 ? '...' : ''));
        
        // Send message to extension
        vscode.postMessage({
            type: 'applyCode',
            value: code,
            metadata: metadata
        });
        
        // Remove the message after 2 seconds
        setTimeout(() => {
            if (applyingMessage && applyingMessage.parentNode) {
                applyingMessage.style.opacity = '0';
                setTimeout(() => {
                    if (applyingMessage.parentNode) {
                        applyingMessage.parentNode.removeChild(applyingMessage);
                    }
                }, 300);
            }
        }, 2000);
    }

    // Show loading indicator
    function showLoadingIndicator() {
        isLoading = true;
        
        // Create loading container
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-dots';
        
        // Add thinking text
        const thinkingText = document.createElement('div');
        thinkingText.className = 'text';
        thinkingText.textContent = 'AI Agent is thinking...';
        loadingDiv.appendChild(thinkingText);
        
        // Add animated dots
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'dots';
        dotsContainer.innerHTML = '<span></span><span></span><span></span>';
        loadingDiv.appendChild(dotsContainer);
        
        // Add to conversation
        conversationContainer.appendChild(loadingDiv);
        scrollToBottom();
    }

    // Hide loading indicator
    function hideLoadingIndicator() {
        isLoading = false;
        const loadingIndicator = document.querySelector('.loading-dots');
        if (loadingIndicator) {
            // Add fade-out animation
            loadingIndicator.style.opacity = '0';
            loadingIndicator.style.transition = 'opacity 0.3s ease-out';
            
            // Remove after animation completes
            setTimeout(() => {
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
            }, 300);
        }
    }

    // Start new chat
    function startNewChat() {
        // Clear conversation history
        conversationHistory = [];
        
        // Clear conversation container
        while (conversationContainer.firstChild) {
            conversationContainer.removeChild(conversationContainer.firstChild);
        }
        
        // Add welcome message
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message system-message';
        welcomeMessage.innerHTML = `
            <div class="message-content">
                <p>Hello! I'm your AI coding assistant. Select some code and use the action buttons above, or ask me a question below.</p>
            </div>
        `;
        conversationContainer.appendChild(welcomeMessage);
        
        // Focus on input
        promptInput.focus();
        
        showSuccess('Started new conversation');
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message system-message error';
        errorDiv.innerHTML = `<div class="message-content"><p>⚠️ ${escapeHtml(message)}</p></div>`;
        conversationContainer.appendChild(errorDiv);
        window.requestAnimationFrame(scrollToBottom);
    }

    // Show success message
    function showSuccess(message, isPersistent = false) {
        const successDiv = document.createElement('div');
        successDiv.className = 'message system-message success';
        successDiv.innerHTML = `<div class="message-content"><p>✓ ${escapeHtml(message)}</p></div>`;
        conversationContainer.appendChild(successDiv);
        window.requestAnimationFrame(scrollToBottom);
        
        // Auto-remove non-persistent messages after a delay
        if (!isPersistent) {
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.style.opacity = '0';
                    successDiv.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        if (successDiv.parentNode) {
                            successDiv.parentNode.removeChild(successDiv);
                        }
                    }, 300);
                }
            }, 3000);
        }
        
        return successDiv;
    }

    // Format markdown text
    function formatMarkdown(text) {
        // Split by line breaks and handle paragraphs
        const lines = text.split('\n');
        let formatted = '';
        let inParagraph = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Empty line - close paragraph if open
            if (line.trim() === '') {
                if (inParagraph) {
                    formatted += '</p>';
                    inParagraph = false;
                }
                continue;
            }
            
            // Start paragraph if not in one
            if (!inParagraph) {
                formatted += '<p>';
                inParagraph = true;
            } else if (i > 0 && lines[i-1].trim() !== '') {
                // Add line break within paragraph
                formatted += '<br>';
            }
            
            // Process the line content with markdown
            formatted += line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');
        }
        
        // Close final paragraph if open
        if (inParagraph) {
            formatted += '</p>';
        }
        
        return formatted;
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Setup proper scroll behavior
    function setupScrollBehavior() {
        // Add scroll indicator button to the DOM
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
        scrollIndicator.title = 'Scroll to recent messages';
        document.querySelector('.container').appendChild(scrollIndicator);
        
        // Allow manual scrolling to view history
        let isUserScrolling = false;
        let scrollTimeout;
        
        // Track when user scrolls up
        conversationContainer.addEventListener('scroll', function() {
            // Detect user initiated scrolling
            isUserScrolling = true;
            
            // Show/hide scroll indicator based on scroll position
            const isAtBottom = window.isAtBottom();
            
            if (!isAtBottom) {
                scrollIndicator.classList.add('visible');
            } else {
                scrollIndicator.classList.remove('visible');
            }
            
            // Reset the flag after scrolling stops
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
            }, 1000);
        });
        
        // Scroll to bottom when indicator is clicked
        scrollIndicator.addEventListener('click', function() {
            // Override user scrolling when button is clicked
            isUserScrolling = false;
            
            // Scroll to bottom
            conversationContainer.scrollTo({
                top: conversationContainer.scrollHeight,
                behavior: 'smooth'
            });
            
            // Hide indicator
            scrollIndicator.classList.remove('visible');
        });
        
        // Track whether we're at the bottom of the scroll
        window.isAtBottom = function() {
            const tolerance = 50; // pixel tolerance
            const scrollPosition = conversationContainer.scrollTop + conversationContainer.clientHeight;
            const totalHeight = conversationContainer.scrollHeight;
            
            return (totalHeight - scrollPosition) <= tolerance;
        };
        
        // Modified version of scrollToBottom that respects user scrolling
        window.scrollToBottomSmart = function() {
            if (!conversationContainer) return;
            
            // Only auto-scroll if user isn't manually scrolling or if we're already at the bottom
            if (!isUserScrolling || isAtBottom()) {
                // Force layout recalculation
                void conversationContainer.offsetHeight;
                
                // Scroll smoothly
                conversationContainer.scrollTo({
                    top: conversationContainer.scrollHeight,
                    behavior: 'smooth'
                });
                
                // Backup direct scroll after a delay
                setTimeout(() => {
                    conversationContainer.scrollTop = conversationContainer.scrollHeight;
                    
                    // Hide scroll indicator as we're at the bottom
                    scrollIndicator.classList.remove('visible');
                }, 100);
            }
        };
    }

    // Scroll to bottom of conversation
    function scrollToBottom() {
        if (!conversationContainer) return;
        
        // Use the smart scroll function if available, otherwise fall back to direct scroll
        if (window.scrollToBottomSmart) {
            window.scrollToBottomSmart();
        } else {
            // Force layout recalculation to ensure accurate scrollHeight
            void conversationContainer.offsetHeight;
            
            // Direct scroll for immediate feedback
            conversationContainer.scrollTop = conversationContainer.scrollHeight;
        }
    }

    // Handle selected code from the editor
    function handleSelectedCode(code) {
        if (!code || code.trim() === '') return;
        
        // Add the code to the input box with backticks
        promptInput.value = code;
        
        // Auto-resize the textarea
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
        
        // Focus the input
        promptInput.focus();
    }

    // Preview code changes to show what will be modified
    function previewCodeChanges(code) {
        // If the code doesn't have patch markers, there's nothing to preview
        if (!code.includes('// ... existing code ...') && 
            !code.includes('/* ... existing code ... */') &&
            !code.includes('# ... existing code ...') &&
            !code.includes('<!-- ... existing code ... -->')) {
            showSuccess('This will replace the entire file content. Add "// ... existing code ..." to mark unchanged sections.');
            return;
        }
        
        // Request the current file content to show a diff preview
        vscode.postMessage({
            type: 'previewCodeChanges',
            value: code
        });
        
        showSuccess('Analyzing code changes...');
    }

    // Handle a code diff preview
    function handleCodeDiff(diffInfo) {
        // Create a diff preview element
        const diffContainer = document.createElement('div');
        diffContainer.className = 'diff-preview';
        
        // Add the diff header
        const diffHeader = document.createElement('div');
        diffHeader.className = 'diff-header';
        diffHeader.innerHTML = `
            <div class="diff-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 16v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="14" height="14" rx="2" ry="2"></rect>
                    <path d="M15 9l-6 6"></path>
                    <path d="M9 9l6 6"></path>
                </svg>
                <span>Code Change Preview - ${diffInfo.fileName || 'Current File'}</span>
            </div>
            <button class="close-diff">×</button>
        `;
        
        // Add diff content
        const diffContent = document.createElement('div');
        diffContent.className = 'diff-content';
        
        // Build a simple diff view showing additions and removals
        const lines = [];
        
        if (diffInfo.changes && diffInfo.changes.length > 0) {
            diffInfo.changes.forEach(change => {
                if (change.type === 'unchanged') {
                    lines.push(`<div class="diff-line unchanged"><span class="line-number">${change.lineNumber || ''}</span><span class="line-content">${escapeHtml(change.content)}</span></div>`);
                } else if (change.type === 'added') {
                    lines.push(`<div class="diff-line added"><span class="line-number">+</span><span class="line-content">${escapeHtml(change.content)}</span></div>`);
                } else if (change.type === 'removed') {
                    lines.push(`<div class="diff-line removed"><span class="line-number">-</span><span class="line-content">${escapeHtml(change.content)}</span></div>`);
                }
            });
        } else {
            // No specific changes, just show the proposed code
            const codeLines = diffInfo.newCode.split('\n');
            codeLines.forEach((line, i) => {
                lines.push(`<div class="diff-line"><span class="line-number">${i+1}</span><span class="line-content">${escapeHtml(line)}</span></div>`);
            });
        }
        
        diffContent.innerHTML = lines.join('');
        
        // Add summary
        const diffSummary = document.createElement('div');
        diffSummary.className = 'diff-summary';
        diffSummary.innerHTML = `
            <div class="diff-stats">
                ${diffInfo.stats ? `
                    <span class="stat added">+${diffInfo.stats.additions || 0}</span>
                    <span class="stat removed">-${diffInfo.stats.removals || 0}</span>
                ` : 'Preview of code changes'}
            </div>
            <div class="diff-actions">
                <button class="apply-diff">Apply Changes</button>
            </div>
        `;
        
        // Assemble the diff container
        diffContainer.appendChild(diffHeader);
        diffContainer.appendChild(diffContent);
        diffContainer.appendChild(diffSummary);
        
        // Add to the conversation
        conversationContainer.appendChild(diffContainer);
        scrollToBottom();
        
        // Setup event handlers
        diffContainer.querySelector('.close-diff').addEventListener('click', () => {
            diffContainer.remove();
        });
        
        diffContainer.querySelector('.apply-diff').addEventListener('click', () => {
            // Send the command to apply the diff
            vscode.postMessage({
                type: 'applyCodeDiff',
                value: diffInfo.newCode,
                metadata: {
                    isPatch: true,
                    fileName: diffInfo.fileName
                }
            });
            
            diffContainer.remove();
            showSuccess('Applying code changes...');
        });
    }

    // Initialize the app
    init();
})(); 