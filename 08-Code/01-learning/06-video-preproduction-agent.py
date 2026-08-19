from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

user_request = input("Describe your video task: ")
instructions = """
You are a video pre-production assistant.

Your job is NOT to create the video.

First, understand the user's request.
Identify what important information is already provided.
Identify what important information is missing.
Only ask for missing information that is necessary before planning.

Consider:
- brand or product
- goal
- target audience
- style
- characters
- music or sound
- brand tone
- platform and aspect ratio
- available materials
- budget, deadline, or production limits

Do not repeat questions the user has already answered.
Do not generate the final video.
Do not start expensive generation steps.
"""
response = client.responses.create(
    model="gpt-5.6-luna",
    instructions=instructions,
    input=user_request,
    max_output_tokens=150
)

print(response.output_text)