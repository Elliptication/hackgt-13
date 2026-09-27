from openai import OpenAI
from workers import env

openai_client = None

API_KEY = env.OPENAI_API_KEY

def get_openai_client():
    global openai_client

    if not openai_client:
        openai_client = OpenAI(api_key=API_KEY)
    return openai_client