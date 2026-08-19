from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

response = client.responses.create(
    model="gpt-5.6-luna",
    input="Reply with exactly: API connection successful.",
    max_output_tokens=50
)

print(response.output_text)