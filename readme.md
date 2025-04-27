# Aivon

##Smarter coding, seamless assistance - an intelligent, context-aware AI assistant that brings Google's Gemini models into your coding workflow via CLI and VS Code extension.


![image](https://github.com/user-attachments/assets/995d74c9-4b64-43c2-a0a9-52f37e4a2d22)



![image](https://github.com/user-attachments/assets/0ebe31bd-70d1-477f-ba89-fc87aacfe015)



## Features

### VS Code Extension
- Interactive chat with Gemini AI directly within your editor
- Code-aware responses - select code for contextual assistance
- One-click actions: explain, optimize, document, and test code
- Project context awareness for comprehensive code understanding
- Secure API key storage in VS Code's secret storage
- Customizable context settings for optimal AI responses

### Command-Line Interface
- Interactive chat mode for ongoing conversations
- Quick single-query responses for immediate answers
- File input support for processing longer prompts
- Project context support for better code-aware responses
- Multiple API key management options
- Colorized output for better readability

## Requirements
- Python 3.6+ (for the CLI and backend)
- VS Code 1.60.0+ (for the extension)
- Gemini API Key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Node.js & npm (for extension development)

## Getting Started

### Installation

1. **Clone this repository**
   ```bash
   git clone https://github.com/itssultania/Aivon.git
   cd Aivon
   ```

2. **Set up the CLI tool**
   ```bash
   pip install -r requirements.txt
   ```

3. **Obtain a Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Set up your API key**
   ```bash
   # Copy the template .env file
   cp .env.template .env
   
   # Edit the .env file and add your Gemini API key
   # On Windows:
   notepad .env
   # On macOS/Linux:
   nano .env
   ```

### VS Code Extension Setup

1. **Build the Extension**
   ```bash
   cd vscode-extension
   npm install
   npm run build
   ```

2. **Install the Extension**
   - **Development Mode**: 
     - Open the vscode-extension folder in VS Code
     - Press F5 to launch with the extension loaded
   
   - **Package and Install**:
     ```bash
     npm install -g @vscode/vsce
     vsce package
     ```
     - In VS Code: Extensions → "..." → "Install from VSIX..."

## Usage

### CLI Commands

```bash
# Basic query
python app.py "What is the time complexity of quicksort?"

# Interactive mode
python app.py -i

# Using a file as input
python app.py --file prompt.txt

# Using a project context file
python app.py --file prompt.txt --context project_context.txt

# Setting API key via command line
python app.py --api-key YOUR_API_KEY "Your prompt here"
```

### VS Code Extension

1. Open the Aivon panel from the Activity Bar
2. Enter your Gemini API key when prompted
3. Start asking questions or use the quick action buttons
4. Toggle project context on/off as needed
5. Configure context settings with the gear icon

## Project Context Feature

The extension analyzes your project structure and relevant files to provide more accurate responses:

- Automatically includes important configuration files
- Scans and includes currently open files for additional context
- Creates a project structure overview for better recommendations
- Configurable settings to control context size and file exclusions

## Project Structure

```
Aivon/
├── app.py                 # CLI tool main file
├── requirements.txt       # Python dependencies
├── README.md              # Documentation
├── vscode-extension/      # VS Code Extension
│   ├── src/               # TypeScript source code
│   ├── media/             # UI assets
│   └── package.json       # Extension manifest
└── resources/             # Images and other assets
```

## Usage Tips

- Select code and use "Explain Code" for detailed explanations
- Toggle project context off for simpler, faster responses
- Use the context settings to customize which files are included
- For large projects, try increasing the context size limit
- Use the CLI tool with `--file` for long prompts or queries

## Privacy & Data Usage

- Your code and prompts are sent to Google's Gemini for processing
- The extension uses your API key to authenticate with Google
- No data is stored on our servers
- The extension respects exclusion patterns to avoid sending sensitive files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


