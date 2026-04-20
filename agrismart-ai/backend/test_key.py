import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
try:
    print('Calling with key:', os.getenv('GEMINI_API_KEY')[:5] if os.getenv('GEMINI_API_KEY') else 'None')
    genai.GenerativeModel('gemini-2.5-flash').generate_content('test')
    print('Success')
except Exception as e:
    print('Error:', e)
