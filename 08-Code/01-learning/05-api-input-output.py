from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

user_input = input("Say something to AI: ")
response = client.responses.create(
    model="gpt-5.6-luna",
    input=user_input,
    max_output_tokens=50
)
print(response.output_text)