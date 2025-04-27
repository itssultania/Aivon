const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Define project types for customization presets
const PROJECT_PRESETS = {
  frontend: {
    maxProjectContextChars: 40000,
    excludePatterns: [
      "node_modules", ".git", "dist", "build", "*.min.js", "*.map"
    ]
  },
  backend: {
    maxProjectContextChars: 35000,
    excludePatterns: [
      "node_modules", ".git", "dist", "logs", "tmp", "*.log", "test/fixtures"
    ]
  },
  datascience: {
    maxProjectContextChars: 30000,
    excludePatterns: [
      ".git", "venv", "__pycache__", "*.csv", "*.json", "*.pkl", "data/raw"
    ]
  },
  default: {
    maxProjectContextChars: 50000,
    excludePatterns: [
      "node_modules", ".git", "dist", "build", "out", "target",
      ".vscode", ".idea", "__pycache__", ".venv", "env",
      "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.ico", "*.mp4", "*.mp3", "*.wav",
      "*.pdf", "*.zip", "*.tar", "*.gz", "*.rar"
    ]
  }
};

// Main function to run the setup
async function runSetup() {
  console.log('\n===============================');
  console.log('Gemini Assistant Setup Wizard');
  console.log('===============================\n');
  
  // Platform detection
  const platform = os.platform();
  let extensionDir;
  
  try {
    if (platform === 'win32') {
      extensionDir = path.join(os.homedir(), '.vscode', 'extensions', 'gemini-assistant');
    } else if (platform === 'darwin') {
      extensionDir = path.join(os.homedir(), '.vscode', 'extensions', 'gemini-assistant');
    } else {
      extensionDir = path.join(os.homedir(), '.vscode', 'extensions', 'gemini-assistant');
    }
  } catch (error) {
    console.error('Error determining extension directory:', error);
  }

  // Install dependencies
  console.log('Installing npm dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully.');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error);
    process.exit(1);
  }
  
  // Check if VSCode is installed
  let vsCodeInstalled = false;
  try {
    execSync('code --version', { stdio: 'ignore' });
    vsCodeInstalled = true;
    console.log('✅ VSCode detected on your system.');
  } catch (error) {
    console.log('⚠️ VSCode command-line tool not found. Some installation options may be limited.');
  }
  
  // User preferences
  console.log('\n--- Customization Options ---');
  
  // Get project type for preset configuration
  const projectType = await question(
    'What type of project will you use this extension with most often?\n' +
    '1) Frontend Web Development (React, Angular, Vue, etc.)\n' +
    '2) Backend Development (Node.js, Python, Java, etc.)\n' +
    '3) Data Science / ML\n' +
    '4) General / Mixed\n' +
    'Enter choice [4]: '
  );
  
  let preset;
  switch (projectType.trim()) {
    case '1': preset = 'frontend'; break;
    case '2': preset = 'backend'; break;
    case '3': preset = 'datascience'; break;
    case '4': 
    default: preset = 'default';
  }
  
  console.log(`\nUsing "${preset}" configuration preset.`);
  
  // Ask for custom model
  const useCustomModel = await question(
    'Do you want to use a custom API endpoint (e.g., for a different Gemini model)? (y/N): '
  );
  
  let customModelEndpoint = '';
  if (useCustomModel.toLowerCase() === 'y') {
    customModelEndpoint = await question('Enter the model endpoint (leave empty for default): ');
  }
  
  // Get installation preference
  console.log('\n--- Installation Options ---');
  
  let installChoice;
  if (vsCodeInstalled) {
    installChoice = await question(
      'How would you like to install the extension?\n' +
      '1) Global installation (recommended)\n' +
      '2) Create portable VSIX package\n' +
      '3) Development mode only\n' +
      'Enter choice [1]: '
    );
    
    if (!installChoice.trim()) {
      installChoice = '1';
    }
  } else {
    installChoice = await question(
      'How would you like to install the extension?\n' +
      '1) Create portable VSIX package\n' +
      '2) Development mode only\n' +
      'Enter choice [1]: '
    );
    
    if (!installChoice.trim()) {
      installChoice = '1';
    }
    
    // Adjust choice number since we skipped an option
    if (installChoice === '1') installChoice = '2';
    else if (installChoice === '2') installChoice = '3';
  }
  
  // Build the extension
  console.log('\nBuilding the extension...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Extension built successfully.');
  } catch (error) {
    console.error('❌ Failed to build the extension:', error);
    process.exit(1);
  }
  
  // Apply customizations
  await applyCustomizations(preset, customModelEndpoint);
  
  // Complete the installation based on user choice
  switch (installChoice) {
    case '1': // Global installation
      console.log('\nInstalling extension globally...');
      try {
        // Copy files to extension directory
        if (platform === 'win32') {
          execSync(`xcopy /E /I /Y "${__dirname}\\*" "${extensionDir}"`, { stdio: 'inherit' });
        } else {
          execSync(`cp -R "${__dirname}/"* "${extensionDir}"`, { stdio: 'inherit' });
        }
        console.log('✅ Extension installed successfully!');
        console.log('\nPlease restart VS Code to use the extension.');
      } catch (error) {
        console.error('❌ Failed to install extension globally:', error);
        console.log('\nYou can try the VSIX installation method instead:');
        await createVsixPackage();
      }
      break;
      
    case '2': // VSIX package
      await createVsixPackage();
      break;
      
    case '3': // Development mode
      console.log('\nSetup for development mode complete!');
      console.log('To run the extension in development mode:');
      console.log(`code --extensionDevelopmentPath="${__dirname}"`);
      break;
  }
  
  console.log('\n🎉 Gemini Assistant setup complete!\n');
  rl.close();
}

// Function to apply customizations
async function applyCustomizations(preset, customModelEndpoint) {
  console.log('\nApplying customizations...');
  
  // Apply preset configuration
  const presetConfig = PROJECT_PRESETS[preset];
  
  // Create a settings file that can be used as workspace settings
  const settingsDir = path.join(__dirname, 'settings-templates');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  
  const settingsObj = {
    "geminiAssistant.maxProjectContextChars": presetConfig.maxProjectContextChars,
    "geminiAssistant.excludePatterns": presetConfig.excludePatterns
  };
  
  // Save preset as template
  const settingsFile = path.join(settingsDir, `${preset}-settings.json`);
  fs.writeFileSync(settingsFile, JSON.stringify(settingsObj, null, 2), 'utf8');
  
  // If custom model endpoint provided, modify app.py
  if (customModelEndpoint) {
    try {
      const appPath = path.join(__dirname, '..', 'app.py');
      if (fs.existsSync(appPath)) {
        let appContent = fs.readFileSync(appPath, 'utf8');
        
        // Find and replace API URL
        const apiUrlRegex = /API_URL\s*=\s*"[^"]+"/;
        if (apiUrlRegex.test(appContent)) {
          appContent = appContent.replace(apiUrlRegex, `API_URL = "${customModelEndpoint}"`);
          fs.writeFileSync(appPath, appContent, 'utf8');
          console.log('✅ Custom API endpoint configured.');
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to configure custom API endpoint:', error);
    }
  }
  
  // Create a helper script for workspace settings
  const helperScript = path.join(__dirname, 'add-to-workspace.js');
  const helperContent = `
// Helper script to add Gemini Assistant configuration to workspace
// Run this from your project directory: node /path/to/add-to-workspace.js [preset]
const fs = require('fs');
const path = require('path');

const preset = process.argv[2] || 'default';
const validPresets = ['default', 'frontend', 'backend', 'datascience'];

if (!validPresets.includes(preset)) {
  console.error('Invalid preset. Choose from: default, frontend, backend, datascience');
  process.exit(1);
}

// Load preset settings
const presetPath = path.join(__dirname, 'settings-templates', \`\${preset}-settings.json\`);
if (!fs.existsSync(presetPath)) {
  console.error(\`Preset file not found: \${presetPath}\`);
  process.exit(1);
}

const presetSettings = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

// Create or update .vscode/settings.json
const vscodeDir = path.join(process.cwd(), '.vscode');
if (!fs.existsSync(vscodeDir)) {
  fs.mkdirSync(vscodeDir, { recursive: true });
}

const settingsPath = path.join(vscodeDir, 'settings.json');
let settings = {};

// Read existing settings if any
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    console.warn('Could not parse existing settings.json, creating new file');
  }
}

// Merge preset settings with existing settings
Object.assign(settings, presetSettings);

// Write updated settings
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

console.log(\`✅ Gemini Assistant \${preset} settings added to workspace.\`);
console.log('Restart VS Code to apply changes.');
`;

  fs.writeFileSync(helperScript, helperContent, 'utf8');
  console.log('✅ Created workspace settings helper script.');
  
  console.log('✅ Customizations applied successfully.');
}

// Function to create VSIX package
async function createVsixPackage() {
  console.log('\nCreating VSIX package...');
  try {
    // Install vsce if not present
    try {
      execSync('npx vsce --version', { stdio: 'ignore' });
    } catch {
      console.log('Installing vsce package...');
      execSync('npm install -g @vscode/vsce', { stdio: 'inherit' });
    }
    
    // Package the extension
    console.log('Creating VSIX package...');
    execSync('npx vsce package', { stdio: 'inherit' });
    
    // Find the created vsix file
    const files = fs.readdirSync('./');
    const vsixFile = files.find(file => file.endsWith('.vsix'));
    
    if (vsixFile) {
      console.log(`\n✅ Portable extension package created: ${vsixFile}`);
      console.log('\nYou can install this in any VS Code instance with:');
      console.log(`code --install-extension ${vsixFile}`);
      
      // Option to install right now
      const installNow = await question('\nWould you like to install the extension now? (Y/n): ');
      if (installNow.toLowerCase() !== 'n') {
        try {
          console.log('Installing extension...');
          execSync(`code --install-extension ${vsixFile}`, { stdio: 'inherit' });
          console.log('✅ Extension installed successfully!');
          console.log('Please restart VS Code to use the extension.');
        } catch (error) {
          console.error('❌ Failed to install extension:', error);
          console.log(`You can manually install later with: code --install-extension ${vsixFile}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to create VSIX package:', error);
  }
}

// Run the setup
runSetup().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
}); 