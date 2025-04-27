import requests
import json
import argparse
import os
from getpass import getpass
import sys
import time
import platform
from typing import Optional, Dict, Any

# Add colorama for cross-platform colored terminal text
try:
    from colorama import init, Fore, Style, Back
    # Initialize colorama
    init(autoreset=True)
    HAS_COLORS = True
except ImportError:
    # Fallback if colorama is not installed
    class DummyFore:
        def __getattr__(self, name):
            return ""
    class DummyStyle:
        def __getattr__(self, name):
            return ""
    class DummyBack:
        def __getattr__(self, name):
            return ""
    Fore = DummyFore()
    Style = DummyStyle()
    Back = DummyBack()
    HAS_COLORS = False

# Add keyboard support for scrolling
try:
    import keyboard
    HAS_KEYBOARD = True
except ImportError:
    HAS_KEYBOARD = False

# Banner and UI constants
BANNER = r"""
  ______              _       _   ___    _____
 / _____)            (_)     (_) / __)  (_____)
| /  ___  ____  ____  _  ____  _| |__     ___
| | (___)/ _  |/ _  || |/ _  || |  __)   (___)
| \____/( ( | ( ( | || ( ( | || | |      ___ 
 \_____/ \_||_|\_||_||_|\_||_||_|_|     (_____)
"""
VERSION = "1.1.0"

# Constants for chat display
MAX_DISPLAY_MESSAGES = 10  # Number of messages to show at once
SCROLL_OFFSET = 0  # Global variable to track scroll position

# UI Constants
UI_SEPARATOR = "─"  # Horizontal separator
UI_MESSAGE_PREFIX_USER = "▷ "  # User message prefix
UI_MESSAGE_PREFIX_AI = "◆ "    # AI message prefix
UI_PRIMARY_COLOR = Fore.CYAN
UI_SECONDARY_COLOR = Fore.WHITE
UI_ACCENT_COLOR = Fore.BLUE
UI_MUTED_COLOR = Fore.LIGHTBLACK_EX
UI_USER_COLOR = Fore.WHITE
UI_AI_COLOR = Fore.CYAN

def clear_screen():
    """Clear the terminal screen in a cross-platform way."""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_banner():
    """Print the application banner with version."""
    clear_screen()
    if HAS_COLORS:
        print(f"{UI_PRIMARY_COLOR}{BANNER}{Style.RESET_ALL}")
        print(f"{UI_PRIMARY_COLOR}Gemini AI Assistant{Style.RESET_ALL} {UI_MUTED_COLOR}v{VERSION}{Style.RESET_ALL}")
        print(f"{UI_SECONDARY_COLOR}{UI_SEPARATOR * 50}{Style.RESET_ALL}\n")
    else:
        print(BANNER)
        print(f"Gemini AI Assistant v{VERSION}")
        print('=' * 50 + "\n")

def spinning_cursor():
    """Generator for a spinning cursor animation."""
    while True:
        for cursor in '|/-\\':
            yield cursor

def query_gemini(prompt: str, api_key: str) -> str:
    """Query Google's Gemini API with the given prompt and API key."""
    if not api_key:
        return f"{UI_MUTED_COLOR}Error: No API key provided. Use --api-key or set GEMINI_API_KEY environment variable.{Style.RESET_ALL}"
        
    # Using Google's Gemini API
    API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
    
    # Add API key as query parameter
    url_with_key = f"{API_URL}?key={api_key}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2000,
            "topP": 0.95
        }
    }

    try:
        # For non-interactive mode, show a simple message instead of spinner animation
        is_vscode_extension = os.environ.get("VSCODE_EXTENSION") == "true"
        
        if not is_vscode_extension:
            # Show loading spinner
            spinner = spinning_cursor()
            if HAS_COLORS:
                print(f"{UI_MUTED_COLOR}Thinking", end="", file=sys.stderr)
            else:
                print("Thinking", end="", file=sys.stderr)
                
            for _ in range(10):  # Show animation for a short time
                sys.stderr.write(f" {next(spinner)}")
                sys.stderr.flush()
                time.sleep(0.1)
                sys.stderr.write("\b\b")
        
        # Make the API request
        response = requests.post(url_with_key, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        if not is_vscode_extension:
            # Clear spinner
            print("\r" + " " * 20 + "\r", end="", file=sys.stderr)
        
        data = response.json()
        
        # Parse Gemini response format
        if "candidates" in data and len(data["candidates"]) > 0:
            content = data["candidates"][0]["content"]
            if "parts" in content and len(content["parts"]) > 0:
                return content["parts"][0]["text"]
        
        # If the expected structure wasn't found, dump the full response
        error_msg = f"Error parsing response from Gemini API. Raw response:\n{json.dumps(data, indent=2)}"
        if HAS_COLORS and not is_vscode_extension:
            return f"{UI_MUTED_COLOR}{error_msg}{Style.RESET_ALL}"
        else:
            return error_msg
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Network Error: {str(e)}"
        if "invalid API key" in str(e).lower() or "unauthorized" in str(e).lower():
            error_msg = "Invalid API key or authorization error. Please check your Gemini API key."
        elif "timeout" in str(e).lower():
            error_msg = "Request timed out. Please check your internet connection and try again."
        
        if HAS_COLORS and not is_vscode_extension:
            return f"{UI_MUTED_COLOR}{error_msg}{Style.RESET_ALL}"
        else:
            return error_msg
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        if HAS_COLORS and not is_vscode_extension:
            return f"{UI_MUTED_COLOR}{error_msg}{Style.RESET_ALL}"
        else:
            return error_msg

def get_api_key() -> Optional[str]:
    """Get API key from environment or prompt user."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        if HAS_COLORS:
            print(f"{UI_MUTED_COLOR}No API key found in environment variables.{Style.RESET_ALL}")
        else:
            print("No API key found in environment variables.")
        try:
            if HAS_COLORS:
                api_key = input(f"{UI_ACCENT_COLOR}Enter your Google Gemini API key: {Style.RESET_ALL}").strip()
            else:
                api_key = input("Enter your Google Gemini API key: ").strip()
        except EOFError:
            # Handle the case where input() fails
            if HAS_COLORS:
                print(f"\n{UI_MUTED_COLOR}Error reading input. Please try providing the API key as a command line argument:{Style.RESET_ALL}")
                print(f"{UI_MUTED_COLOR}python app.py -i --api-key YOUR_API_KEY{Style.RESET_ALL}")
            else:
                print("\nError reading input. Please try providing the API key as a command line argument:")
                print("python app.py -i --api-key YOUR_API_KEY")
            sys.exit(1)
    return api_key

def save_api_key(api_key: str) -> None:
    """Save API key to config file."""
    config_dir = os.path.expanduser("~/.gemini_cli")
    os.makedirs(config_dir, exist_ok=True)
    config_file = os.path.join(config_dir, "config.json")
    
    config = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
        except:
            pass
    
    config['api_key'] = api_key
    
    try:
        with open(config_file, 'w') as f:
            json.dump(config, f)
        
        if HAS_COLORS:
            print(f"{UI_ACCENT_COLOR}API key saved for future use{Style.RESET_ALL}")
        else:
            print("API key saved for future use")
    except Exception as e:
        if HAS_COLORS:
            print(f"{UI_MUTED_COLOR}Failed to save API key: {str(e)}{Style.RESET_ALL}")
        else:
            print(f"Failed to save API key: {str(e)}")

def load_api_key() -> Optional[str]:
    """Load API key from config file."""
    config_file = os.path.expanduser("~/.gemini_cli/config.json")
    
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                return config.get('api_key')
        except:
            return None
    
    return None

def print_help_interactive():
    """Print help text for interactive mode."""
    help_text = [
        ("exit/quit", "Exit the application"),
        ("clear", "Clear the screen"),
        ("help", "Show this help message"),
        ("!save", "Save the current API key for future use"),
        ("!history", "View your conversation history")
    ]
    
    if HAS_KEYBOARD:
        help_text.append(("↑/↓ arrows", "Scroll through conversation history"))
        help_text.append(("Page Up/Down", "Scroll multiple messages at once"))
    
    if HAS_COLORS:
        print(f"\n{UI_PRIMARY_COLOR}Commands{Style.RESET_ALL}")
        for cmd, desc in help_text:
            print(f"  {UI_ACCENT_COLOR}{cmd:<15}{Style.RESET_ALL} {UI_MUTED_COLOR}{desc}{Style.RESET_ALL}")
    else:
        print("\nAvailable commands:")
        for cmd, desc in help_text:
            print(f"  {cmd:<15} - {desc}")
    print()

def format_response(response: str) -> str:
    """Format AI response with proper styling."""
    if HAS_COLORS:
        return f"{UI_AI_COLOR}{response}{Style.RESET_ALL}"
    return response

def display_chat_history(history, scroll_offset=0):
    """Display chat history with scrolling capability."""
    clear_screen()
    print_banner()
    
    if not history:
        if HAS_COLORS:
            print(f"{UI_MUTED_COLOR}No conversation history yet.{Style.RESET_ALL}")
        else:
            print("No conversation history yet.")
        return
    
    total_messages = len(history)
    start_idx = max(0, min(total_messages - MAX_DISPLAY_MESSAGES, scroll_offset))
    end_idx = min(total_messages, start_idx + MAX_DISPLAY_MESSAGES)
    
    if HAS_COLORS:
        print(f"{UI_PRIMARY_COLOR}Conversation{Style.RESET_ALL} {UI_MUTED_COLOR}({start_idx+1}-{end_idx} of {total_messages}){Style.RESET_ALL}")
        print(f"{UI_MUTED_COLOR}Use arrow keys to scroll{Style.RESET_ALL}")
    else:
        print(f"Conversation ({start_idx+1}-{end_idx} of {total_messages}):")
        print("Use arrow keys to scroll")
    
    print(f"{UI_SECONDARY_COLOR}{UI_SEPARATOR * 50}{Style.RESET_ALL}")
    
    for i, (q, a) in enumerate(history[start_idx:end_idx], start_idx + 1):
        if HAS_COLORS:
            print(f"{UI_USER_COLOR}{UI_MESSAGE_PREFIX_USER}{q}{Style.RESET_ALL}")
            print(f"{UI_AI_COLOR}{UI_MESSAGE_PREFIX_AI}{a}{Style.RESET_ALL}")
            print(f"{UI_MUTED_COLOR}{UI_SEPARATOR * 50}{Style.RESET_ALL}")
        else:
            print(f"You: {q}")
            print(f"AI: {a}")
            print("-" * 50)
    
    if start_idx > 0:
        print(f"{UI_MUTED_COLOR}↑ More messages above ↑{Style.RESET_ALL}")
    if end_idx < total_messages:
        print(f"{UI_MUTED_COLOR}↓ More messages below ↓{Style.RESET_ALL}")

def main():
    """Main function to handle CLI arguments and run the query."""
    parser = argparse.ArgumentParser(description="Gemini AI Assistant CLI")
    parser.add_argument("prompt", nargs="?", help="The prompt to send to the AI")
    parser.add_argument("--api-key", "-k", help="Google Gemini API key")
    parser.add_argument("--interactive", "-i", action="store_true", help="Run in interactive mode")
    parser.add_argument("--file", "-f", help="Read prompt from a file")
    parser.add_argument("--context", "-c", help="Additional context file (for project context)")
    parser.add_argument("--version", "-v", action="store_true", help="Show version information")
    parser.add_argument("--install-deps", action="store_true", help="Install required dependencies")
    
    args = parser.parse_args()
    
    # Show version and exit
    if args.version:
        if HAS_COLORS:
            print(f"{UI_PRIMARY_COLOR}Gemini AI Assistant{Style.RESET_ALL} {UI_MUTED_COLOR}v{VERSION}{Style.RESET_ALL}")
            print(f"{UI_MUTED_COLOR}Running on Python {platform.python_version()}{Style.RESET_ALL}")
            print(f"{UI_MUTED_COLOR}Platform: {platform.platform()}{Style.RESET_ALL}")
        else:
            print(f"Gemini AI Assistant v{VERSION}")
            print(f"Running on Python {platform.python_version()}")
            print(f"Platform: {platform.platform()}")
        return
    
    # Install dependencies
    if args.install_deps:
        try:
            print("Installing required dependencies...")
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "colorama", "requests", "keyboard"])
            print("Dependencies installed successfully. Please restart the application.")
            return
        except Exception as e:
            print(f"Failed to install dependencies: {str(e)}")
            return
    
    # Get API key from arguments, environment, config file, or user input
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY") or load_api_key()
    if not api_key:
        try:
            if HAS_COLORS:
                print(f"{UI_MUTED_COLOR}Please enter your Google Gemini API key:{Style.RESET_ALL}")
                api_key = input(f"{UI_ACCENT_COLOR}> {Style.RESET_ALL}").strip()
            else:
                print("Please enter your Google Gemini API key:")
                api_key = input("> ").strip()
                
            if not api_key:
                if HAS_COLORS:
                    print(f"{UI_MUTED_COLOR}Error: API key is required.{Style.RESET_ALL}")
                else:
                    print("Error: API key is required.")
                sys.exit(1)
        except Exception as e:
            if HAS_COLORS:
                print(f"{UI_MUTED_COLOR}Error reading input: {str(e)}{Style.RESET_ALL}")
                print(f"{UI_MUTED_COLOR}Please try providing the API key as a command line argument:{Style.RESET_ALL}")
                print(f"{UI_MUTED_COLOR}python app.py -i --api-key YOUR_API_KEY{Style.RESET_ALL}")
            else:
                print(f"Error reading input: {str(e)}")
                print("Please try providing the API key as a command line argument:")
                print("python app.py -i --api-key YOUR_API_KEY")
            sys.exit(1)
    
    # Interactive mode
    if args.interactive:
        print_banner()
        if HAS_COLORS:
            print(f"{UI_PRIMARY_COLOR}Gemini AI Assistant{Style.RESET_ALL} {UI_MUTED_COLOR}v{VERSION}{Style.RESET_ALL}")
            print(f"{UI_MUTED_COLOR}Type 'help' for commands{Style.RESET_ALL}")
        else:
            print("Gemini AI Assistant - Interactive Mode")
            print("Type 'help' to see available commands")
        
        history = []
        viewing_history = False
        scroll_offset = 0
        
        while True:
            try:
                if viewing_history and HAS_KEYBOARD:
                    # Display chat history with scrolling
                    display_chat_history(history, scroll_offset)
                    
                    # Listen for key presses to handle scrolling
                    key_event = keyboard.read_event(suppress=True)
                    if key_event.event_type == keyboard.KEY_DOWN:
                        if key_event.name == 'esc':
                            viewing_history = False
                            clear_screen()
                            print_banner()
                        elif key_event.name == 'up':
                            scroll_offset = max(0, scroll_offset - 1)
                        elif key_event.name == 'down':
                            scroll_offset = min(len(history) - 1, scroll_offset + 1)
                        elif key_event.name == 'page up':
                            scroll_offset = max(0, scroll_offset - MAX_DISPLAY_MESSAGES)
                        elif key_event.name == 'page down':
                            scroll_offset = min(len(history) - 1, scroll_offset + MAX_DISPLAY_MESSAGES)
                    continue
                
                if HAS_COLORS:
                    prompt = input(f"\n{UI_USER_COLOR}{UI_MESSAGE_PREFIX_USER}{Style.RESET_ALL}")
                else:
                    prompt = input("\n> ")
                    
                if prompt.lower() in ["exit", "quit"]:
                    if HAS_COLORS:
                        print(f"{UI_MUTED_COLOR}Goodbye!{Style.RESET_ALL}")
                    else:
                        print("Goodbye!")
                    break
                    
                elif prompt.lower() == "clear":
                    clear_screen()
                    print_banner()
                    continue
                    
                elif prompt.lower() == "help":
                    print_help_interactive()
                    continue
                    
                elif prompt.lower() == "!save" and api_key:
                    save_api_key(api_key)
                    continue
                    
                elif prompt.lower() == "!history":
                    if not history:
                        if HAS_COLORS:
                            print(f"{UI_MUTED_COLOR}No conversation history yet.{Style.RESET_ALL}")
                        else:
                            print("No conversation history yet.")
                        continue
                    
                    if HAS_KEYBOARD:
                        viewing_history = True
                        scroll_offset = 0
                    else:
                        # Show history without scrolling for systems without keyboard package
                        if HAS_COLORS:
                            print(f"\n{UI_PRIMARY_COLOR}Conversation{Style.RESET_ALL}")
                        else:
                            print("\nConversation History:")
                        print(f"{UI_SECONDARY_COLOR}{UI_SEPARATOR * 50}{Style.RESET_ALL}")
                        for i, (q, a) in enumerate(history):
                            if HAS_COLORS:
                                print(f"{UI_USER_COLOR}{UI_MESSAGE_PREFIX_USER}{q}{Style.RESET_ALL}")
                                print(f"{UI_AI_COLOR}{UI_MESSAGE_PREFIX_AI}{a}{Style.RESET_ALL}")
                                print(f"{UI_MUTED_COLOR}{UI_SEPARATOR * 50}{Style.RESET_ALL}")
                            else:
                                print(f"\nYou: {q}")
                                print(f"AI: {a}")
                                print("-" * 50)
                    continue
                    
                elif not prompt:
                    continue
                
                response = query_gemini(prompt, api_key)
                if HAS_COLORS:
                    print(f"\n{UI_AI_COLOR}{UI_MESSAGE_PREFIX_AI}{response}{Style.RESET_ALL}")
                else:
                    print(f"\n{response}")
                
                # Save to history
                history.append((prompt, response))
                
            except KeyboardInterrupt:
                if viewing_history:
                    viewing_history = False
                    clear_screen()
                    print_banner()
                    continue
                if HAS_COLORS:
                    print(f"\n{UI_MUTED_COLOR}Goodbye!{Style.RESET_ALL}")
                else:
                    print("\nGoodbye!")
                break
                
            except Exception as e:
                if HAS_COLORS:
                    print(f"\n{UI_MUTED_COLOR}Error: {str(e)}{Style.RESET_ALL}")
                else:
                    print(f"\nError: {str(e)}")
    
    # File input
    elif args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                prompt = f.read()
            if HAS_COLORS:
                print(f"{UI_MUTED_COLOR}Reading prompt from file: {args.file}{Style.RESET_ALL}")
            else:
                print(f"Reading prompt from file: {args.file}")
            
            # Add context from context file if provided
            if args.context:
                try:
                    with open(args.context, "r", encoding="utf-8") as f:
                        context = f.read()
                    prompt = f"Project Context:\n{context}\n\nQuery: {prompt}"
                    if HAS_COLORS:
                        print(f"{UI_MUTED_COLOR}Added project context from {args.context}{Style.RESET_ALL}")
                    else:
                        print(f"Added project context from {args.context}")
                except Exception as e:
                    if HAS_COLORS:
                        print(f"{UI_MUTED_COLOR}Error reading context file: {str(e)}{Style.RESET_ALL}")
                    else:
                        print(f"Error reading context file: {str(e)}")
            
            response = query_gemini(prompt, api_key)
            if HAS_COLORS:
                print(f"\n{UI_AI_COLOR}{UI_MESSAGE_PREFIX_AI}{response}{Style.RESET_ALL}")
            else:
                print(f"\n{response}")
        except Exception as e:
            if HAS_COLORS:
                print(f"{UI_MUTED_COLOR}Error reading file: {str(e)}{Style.RESET_ALL}")
            else:
                print(f"Error reading file: {str(e)}")
    # Single prompt from command line
    elif args.prompt:
        max_attempts = 3
        attempts = 0
        prompt = args.prompt
        
        # Add context from file if provided
        if args.context:
            try:
                with open(args.context, "r", encoding="utf-8") as f:
                    context = f.read()
                prompt = f"Project Context:\n{context}\n\nQuery: {prompt}"
                if HAS_COLORS:
                    print(f"{UI_MUTED_COLOR}Added project context from {args.context}{Style.RESET_ALL}")
                else:
                    print(f"Added project context from {args.context}")
            except Exception as e:
                if HAS_COLORS:
                    print(f"{UI_MUTED_COLOR}Error reading context file: {str(e)}{Style.RESET_ALL}")
                else:
                    print(f"Error reading context file: {str(e)}")
        
        while attempts < max_attempts:
            response = query_gemini(prompt, api_key)
            if HAS_COLORS:
                print(f"\n{UI_AI_COLOR}{UI_MESSAGE_PREFIX_AI}{response}{Style.RESET_ALL}")
            else:
                print(f"\n{response}")

            if HAS_COLORS:
                feedback = input(f"{UI_MUTED_COLOR}Was this response helpful? (yes/no): {Style.RESET_ALL}").strip().lower()
            else:
                feedback = input("Was this response helpful? (yes/no): ").strip().lower()
                
            if feedback in ("yes", "y"):
                break
            prompt += "\nNote: The previous response was not helpful. Try again."
            attempts += 1

    
    # No prompt provided, show help
    else:
        parser.print_help()
        if HAS_COLORS:
            print(f"\n{UI_MUTED_COLOR}For a better experience with colors, install colorama:{Style.RESET_ALL}")
            print(f"{UI_ACCENT_COLOR}    pip install colorama{Style.RESET_ALL}")
            print(f"\n{UI_MUTED_COLOR}For scrollable chat history, install keyboard:{Style.RESET_ALL}")
            print(f"{UI_ACCENT_COLOR}    pip install keyboard{Style.RESET_ALL}")
            
            if not HAS_COLORS or not HAS_KEYBOARD:
                print(f"\n{UI_ACCENT_COLOR}Tip: Run with --install-deps to automatically install dependencies.{Style.RESET_ALL}")
        else:
            print("\nFor a better experience with colors, install colorama:")
            print("    pip install colorama")
            print("\nFor scrollable chat history, install keyboard:")
            print("    pip install keyboard")
            if not HAS_COLORS or not HAS_KEYBOARD:
                print("\nTip: Run with --install-deps to automatically install dependencies.")

if __name__ == "__main__":
    main()
