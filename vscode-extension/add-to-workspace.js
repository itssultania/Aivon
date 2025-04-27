
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
const presetPath = path.join(__dirname, 'settings-templates', `${preset}-settings.json`);
if (!fs.existsSync(presetPath)) {
  console.error(`Preset file not found: ${presetPath}`);
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

console.log(`✅ Gemini Assistant ${preset} settings added to workspace.`);
console.log('Restart VS Code to apply changes.');
