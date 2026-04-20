import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
try:
    print('Testing 2.0-flash...')
    res = genai.GenerativeModel('gemini-2.0-flash').generate_content('test')
    print('Success with 2.0-flash!', res.text[:20])
except Exception as e:
    print('Error with 2.0-flash:', e)
