import json
from google import genai

gemini_client = genai.Client()

REASONING_MASTER_PROMPT = """
You are an expert Reasoning Analyzer Agent.
Your sole job is to evaluate the candidate's logical thinking, complexity awareness, and debugging reasoning from their spoken explanation.
DO NOT evaluate code correctness. Evaluate the *thinking process*.

Input Format:
{
  "approach_explanation": "...",
  "problem": "...",
  "candidate_steps": "..."
}

Evaluate:
- Decomposition ability
- Example usage
- Complexity awareness
- Tradeoff discussion

Return ONLY valid JSON in this exact format, with no markdown code blocks:
{
  "problem_solving_score": <int 0-10>,
  "reasoning_score": <int 0-10>,
  "complexity_awareness": <int 0-10>,
  "debugging_skill": <int 0-10>,
  "analysis_notes": ["...", "..."]
}
"""

async def call_reasoning_agent(payload: dict) -> dict:
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"role": "user", "parts": [{"text": REASONING_MASTER_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. Awaiting candidate explanation."}]},
                {"role": "user", "parts": [{"text": json.dumps(payload)}]}
            ],
            config={
                "response_mime_type": "application/json"
            }
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[REASONING AGENT ERROR] {e}")
        return {
            "problem_solving_score": 5, "reasoning_score": 5,
            "complexity_awareness": 5, "debugging_skill": 5,
            "analysis_notes": ["Evaluation failed"]
        }
