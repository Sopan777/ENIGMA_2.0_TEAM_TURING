from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdfplumber
import io
import os
import json
from google import genai
from google.genai import types

os.environ["GEMINI_API_KEY"] = "AIzaSyCHFvdwESWRl-w2bza98KgtURYke0uEqUo"
client = genai.Client()

app = FastAPI(title="Resume Parser API")

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResumeResponse(BaseModel):
    filename: str
    extracted_text: str
    summary: str

class GenerateRequest(BaseModel):
    topic: str
    context: str = ""

class GenerateResponse(BaseModel):
    title: str
    description: str
    starting_code: str
    language: str

class EvaluateRequest(BaseModel):
    problem_title: str
    problem_description: str
    user_code: str
    language: str

class EvaluateResponse(BaseModel):
    passed: bool
    feedback: str

@app.post("/api/parse-resume", response_model=ResumeResponse)
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.pdf')):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported")

    content = await file.read()
    extracted_text = ""
    
    try:
        # Extract text using pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
                    
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the provided PDF")
            
        # Basic summarization logic - getting first 500 chars 
        # (In a real scenario, this is where you'd connect an LLM)
        summary = extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
            
        return ResumeResponse(
            filename=file.filename,
            extracted_text=extracted_text.strip(),
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing resume: {str(e)}")

@app.post("/api/generate-problem", response_model=GenerateResponse)
async def generate_problem(req: GenerateRequest):
    prompt = f"""You are an expert technical interviewer. 
Generate a coding problem based on the following topic: {req.topic}.
If any context is provided, try to slightly tailor the question flavor to their experience: {req.context}

Respond strictly in JSON format matching this schema:
{{
  "title": "String, short problem name",
  "description": "String, detailed problem description, constraints, and examples formatted nicely",
  "starting_code": "String, initial code template (e.g., function definition) in Python or JS based on the topic",
  "language": "String, either 'python' or 'javascript'"
}}
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        data = json.loads(response.text)
        return GenerateResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Generation Failed: {str(e)}")

@app.post("/api/evaluate-solution", response_model=EvaluateResponse)
async def evaluate_solution(req: EvaluateRequest):
    prompt = f"""You are an expert technical interviewer evaluating a candidate's code submission.
Problem: {req.problem_title}
Description: {req.problem_description}
Language: {req.language}
Candidate Code:
{req.user_code}

Evaluate the code for correctness. Check if it solves the problem, handles edge cases, and doesn't have major syntax errors.
Respond strictly in JSON format matching this schema:
{{
  "passed": boolean (true if the code is a basically correct solution, false otherwise),
  "feedback": "String, short encouraging feedback explaining what is right or wrong, max 3 sentences"
}}
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        data = json.loads(response.text)
        return EvaluateResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Evaluation Failed: {str(e)}")

@app.get("/")
def read_root():
    return {"status": "Resume Parser API is running"}
