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

        prompt = f"""Analyze the provided acoustic features to characterize the auditory profile.
                    Acoustic Data:
                    {data}

                    Provide a concise empirical analysis detailing:
                    1. Acoustic Environment: Characterize the ambient setting, reverberant properties, or spatial context indicated by the data.
                    2. Noise Typology and Characteristics: Identify and classify noise sources (e.g., stationary, transient, broadband, narrowband) and their spectral/temporal properties.
                    3. Key Acoustic Observations: Detail notable signal phenomena, salient frequency components, or anomalous acoustic events.

                    Maintain an objective, academic tone and ensure the analysis is highly concise.
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