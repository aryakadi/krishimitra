import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
models_to_test = ['gemini-flash-latest', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-2.5-flash-lite']
for m in models_to_test:
    sys_m = "models/" + m
    try:
        genai.GenerativeModel(m).generate_content('test')
        print(f'{m}: SUCCESS!')
    except Exception as e:
        err = str(e).split('\n')[0][:100] if '\n' in str(e) else str(e)[:100]
        print(f'{m}: {err}')
