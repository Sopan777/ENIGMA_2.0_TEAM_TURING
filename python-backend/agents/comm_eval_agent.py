import json
from google import genai

gemini_client = genai.Client()

COMM_MASTER_PROMPT = """
You are an expert Communication Evaluator Agent for technical interviews.
Your sole responsibility is to evaluate the candidate's speech capabilities from transcripts.
You evaluate:
- Clarity: Ratio of concrete statements to filler words.
- Structure: Presence of structured thinking (e.g. "first, then", "step 1").
- Confidence & Directness.

Input Format:
{
  "transcript": "...",
  "timing_data": { ... } // Optional
}

Return ONLY valid JSON in this exact format, with no markdown code blocks:
{
  "communication_score": <int 0-10>,
  "clarity_score": <int 0-10>,
  "structure_score": <int 0-10>,
  "confidence_score": <int 0-10>,
  "issues_detected": ["..."],
  "positive_signals": ["..."]
}
"""

async def call_comm_eval_agent(payload: dict) -> dict:
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"role": "user", "parts": [{"text": COMM_MASTER_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. Awaiting transcript."}]},
                {"role": "user", "parts": [{"text": json.dumps(payload)}]}
            ],
            config={
                "response_mime_type": "application/json"
            }
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[COMM AGENT ERROR] {e}")
        return {
            "communication_score": 5, "clarity_score": 5,
            "structure_score": 5, "confidence_score": 5,
            "issues_detected": ["Evaluation failed"],
            "positive_signals": []
        }
