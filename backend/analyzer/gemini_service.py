import os

import google.generativeai as genai

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv(
    "GEMINI_API_KEY"
)

print("\nAPI KEY LOADED:", API_KEY)

genai.configure(
    api_key=API_KEY
)

model = genai.GenerativeModel(
    "gemini-2.5-flash"
)

def interpret_audio_features(data):

    try:

        prompt = f"""
        Analyze these acoustic features.

        Acoustic Data:
        {data}

        Describe:
        - sound environment
        - noise characteristics
        - acoustic observations

        Keep concise.
        """

        response = model.generate_content(
            prompt
        )

        print("\nGEMINI RESPONSE:")
        print(response.text)

        return response.text

    except Exception as e:

        print("\nGEMINI ERROR:")
        print(str(e))

        return f"Gemini Error: {str(e)}"