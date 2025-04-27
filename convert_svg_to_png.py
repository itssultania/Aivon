#!/usr/bin/env python3
import cairosvg
import os

# Input and output file paths
svg_path = 'vscode-extension/resources/icon.svg'
png_path = 'vscode-extension/resources/icon.png'

# Create directories if they don't exist
os.makedirs(os.path.dirname(png_path), exist_ok=True)

# Convert SVG to PNG
cairosvg.svg2png(url=svg_path, write_to=png_path)

print(f"Successfully converted {svg_path} to {png_path}") 