import os
import json
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from fastapi import HTTPException

# Initialize Gemini
os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")
gemini_client = genai.Client()

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY", "")
openai_client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else None

async def generate_content_with_fallback(prompt: str, expect_json: bool = False) -> str:
    """
    Tries to generate content using Gemini-2.5-flash.
    If it fails (e.g. Rate Limit 429), it falls back to OpenAI (gpt-4o-mini).
    
    Returns the resulting text.
    """
    # 1. Try Gemini
    try:
        config_kwargs = {}
        if expect_json:
            config_kwargs["response_mime_type"] = "application/json"
            
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(**config_kwargs),
        )
        return response.text
    except Exception as gemini_err:
        print(f"[LLM WARNING] Gemini failed: {gemini_err}. Attempting OpenAI fallback...")
        
        # 2. Try OpenAI Fallback
        if not openai_client:
            raise HTTPException(
                status_code=500, 
                detail=f"Gemini AI Failed and no OPENAI_API_KEY provided for fallback. Gemini error: {str(gemini_err)}"
            )
            
        try:
            messages = [{"role": "user", "content": prompt}]
            
            response_format = None
            if expect_json:
                response_format = {"type": "json_object"}
                # OpenAI requires the word "json" in the prompt if response_format is json_object
                if "json" not in prompt.lower():
                    messages.append({"role": "system", "content": "Respond strictly in JSON format."})
                    
            completion = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                response_format=response_format
            )
            return completion.choices[0].message.content
        except Exception as openai_err:
            print(f"[LLM ERROR] OpenAI fallback also failed: {openai_err}")
            raise HTTPException(
                status_code=500, 
                detail=f"Both Gemini and OpenAI failed. Gemini: {str(gemini_err)} | OpenAI: {str(openai_err)}"
            )
