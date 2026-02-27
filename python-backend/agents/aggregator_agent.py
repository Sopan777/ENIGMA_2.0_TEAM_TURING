import json
from google import genai

gemini_client = genai.Client()

AGGREGATOR_MASTER_PROMPT = """
You are the Final Evaluation Aggregator Agent for technical interviews.
Your job is to combine outputs from the Code Judge, Communication Evaluator, and Reasoning Analyzer into a single cohesive report.

Input Format:
{
  "code_judge": { ... },
  "communication_eval": { ... },
  "reasoning_eval": { ... },
  "proctor_warnings": ["..."],
  "browser_warnings": [{"type": "...", "message": "...", "is_terminal": false}],
  "session_summary": "..."
}

Apply these weights to calculate the final score (0-100%):
- Technical Correctness: 30%
- Problem Solving: 20%
- Reasoning: 15%
- Code Quality: 15%
- Communication: 10%
- Interview Readiness: 10%

🚨 ANTI-CHEAT INTEGRITY SCORE (0-100%):
Based on the `proctor_warnings` (webcam behavior) and `browser_warnings` (tab switch, copy/paste), deduct from 100%.
- Minus 10 points per `proctor_warnings` occurrence.
- Minus 20 points per `browser_warnings` occurrence.
- If Integrity Score is < 50%, reduce the final performance_level to 'No Hire' with a strict justification.

Return ONLY valid JSON in this exact format, with no markdown code blocks:
{
  "summary": "Short 2-line summary",
  "scores": {
    "technical_correctness": <0-10>,
    "problem_solving": <0-10>,
    "reasoning": <0-10>,
    "code_quality": <0-10>,
    "communication": <0-10>,
    "integrity_score": <0-100>,
    "final_score_percent": <0-100>
  },
  "justifications": {
    "technical_correctness": "...",
    "communication": "...",
    "reasoning": "..."
  },
  "actionable_recommendations": [
    "...", "..."
  ],
  "performance_level": "Hire | Strong Hire | Borderline | No Hire"
}
"""

async def call_aggregator_agent(payload: dict) -> dict:
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"role": "user", "parts": [{"text": AGGREGATOR_MASTER_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. Awaiting final session data."}]},
                {"role": "user", "parts": [{"text": json.dumps(payload)}]}
            ],
            config={
                "temperature": 0.1, # Keep it deterministic for math and scoring
                "response_mime_type": "application/json"
            }
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[AGGREGATOR AGENT ERROR] {e}")
        return {
            "summary": "Evaluation failed due to an error.",
            "scores": {
                "technical_correctness": 0, "problem_solving": 0, "reasoning": 0,
                "code_quality": 0, "communication": 0, "interview_readiness": 0,
                "final_score_percent": 0
            },
            "justifications": {},
            "actionable_recommendations": [],
            "performance_level": "No Hire"
        }
