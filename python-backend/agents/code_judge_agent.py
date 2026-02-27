import json
from google import genai

gemini_client = genai.Client()

JUDGE_MASTER_PROMPT = """
You are an expert Technical Code Judge.
Your sole responsibility is to evaluate code submissions objectively.
You do NOT engage in conversation. You do NOT look at transcripts.

Input Format:
{
  "code": "...",
  "language": "python",
  "problem": "...",
  "constraints": "...",
  "test_results": { ... }
}

Evaluate:
1. Pass rate & Correctness
2. Time & Space Complexity
3. Edge case handling (null, empty, large inputs)
4. Readability and Structure (naming, modularity)

Return ONLY valid JSON in this exact format, with no markdown code blocks:
{
  "technical_correctness": <0-10>,
  "code_quality": <0-10>,
  "efficiency_rating": <0-10>,
  "edge_case_handling": <0-10>,
  "issues_detected": ["...", "..."],
  "optimization_suggestions": ["...", "..."]
}
"""

async def call_code_judge_agent(payload: dict) -> dict:
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"role": "user", "parts": [{"text": JUDGE_MASTER_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. Awaiting code."}]},
                {"role": "user", "parts": [{"text": json.dumps(payload)}]}
            ],
            config={
                "temperature": 0.2, # Low temp for deterministic grading
                "response_mime_type": "application/json"
            }
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[JUDGE AGENT ERROR] {e}")
        return {
            "technical_correctness": 0, "code_quality": 0,
            "efficiency_rating": 0, "edge_case_handling": 0,
            "issues_detected": ["Judge evaluation failed"],
            "optimization_suggestions": []
        }
