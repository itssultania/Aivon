import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load API Key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")  # Try both for backward compatibility
if not api_key:
    print("Warning: No API key found. Please set GEMINI_API_KEY in your environment or .env file.")
genai.configure(api_key=api_key)

def generate_plan(task):
    prompt = f"""
You are a coding assistant. Given the task: "{task}", generate the code or shell command(s) needed to perform it.
Only output the code, no explanation.
"""
    try:
        if not api_key:
            return "Error: No API key provided. Please set GEMINI_API_KEY in your environment or .env file."
        model = genai.GenerativeModel(model_name="gemini-pro")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Error generating plan: {e}"

