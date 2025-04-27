# executor.py
import subprocess
import os
import tempfile
import shutil
import re

def execute_code(code):
    print("\n🚀 Executing plan...")
    try:
        # Create a temporary directory that will be automatically cleaned up
        temp_dir = tempfile.mkdtemp(prefix="ai_agent_")
        temp_file_path = os.path.join(temp_dir, "temp_task.py")
        
        if code.startswith("#!") or "def " in code or "import " in code:
            # Handle Python code
            with open(temp_file_path, "w") as f:
                f.write(code)
            
            # Use a list for command arguments (safer than shell=True)
            result = subprocess.run(["python", temp_file_path], 
                                   capture_output=True, 
                                   text=True,
                                   cwd=temp_dir)
        else:
            # For shell commands, do basic sanitization
            # Restrict potentially dangerous commands
            dangerous_patterns = [
                r'rm\s+-rf\s+/',        # Removing system directories
                r'>\s+/dev/',           # Writing to device files
                r'dd\s+if=',            # Raw disk operations
                r'mkfs',                # Formatting filesystems
                r'wget\s+.+\s+\|\s+bash', # Piping web content to bash
                r'curl\s+.+\s+\|\s+bash'  # Piping curl to bash
            ]
            
            for pattern in dangerous_patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return False
            
            # Execute the command in a controlled environment
            result = subprocess.run(code, 
                                  shell=True, 
                                  capture_output=True, 
                                  text=True,
                                  cwd=temp_dir)
        
        print("\n📤 Output:\n", result.stdout)
        if result.stderr:
            print("\n⚠️ Errors:\n", result.stderr)
        
        # Clean up
        shutil.rmtree(temp_dir, ignore_errors=True)
        return result.returncode == 0
    except Exception as e:
        print(f"\n❌ Exception during execution: {e}")
        # Clean up in case of exception
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir, ignore_errors=True)
        return False
