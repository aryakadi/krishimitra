import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
try:
    print('Testing gemini-1.5-flash...')
    res = genai.GenerativeModel('gemini-1.5-flash').generate_content('test')
    print('Success:', res.text[:20])
except Exception as e:
    print('Error:', e)
