from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import pdfplumber
import io
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from llm_manager import generate_content_with_fallback

app = FastAPI(title="Resume Parser API")

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated avatar videos
media_dir = Path(__file__).parent / "generated_media"
media_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

# Serve avatar image
from fastapi.responses import FileResponse
avatar_path = Path(__file__).parent / "avatar.png"

@app.get("/avatar.png")
async def get_avatar():
    if avatar_path.exists():
        return FileResponse(str(avatar_path), media_type="image/png")
    raise HTTPException(status_code=404, detail="Avatar not found")

from chat_routes import router as chat_router
app.include_router(chat_router)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client_mongo = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
db = client_mongo.interview_app_db

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

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
        response_text = await generate_content_with_fallback(prompt, expect_json=True)
        data = json.loads(response_text)
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
        response_text = await generate_content_with_fallback(prompt, expect_json=True)
        data = json.loads(response_text)
        return EvaluateResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Evaluation Failed: {str(e)}")

@app.post("/api/register")
async def register(user: UserCreate):
    try:
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        user_dict = {
            "username": user.username,
            "email": user.email,
            "hashed_password": hashed_password
        }
        await db.users.insert_one(user_dict)
        return {"message": "User registered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/login", response_model=TokenResponse)
async def login(user: UserLogin):
    try:
        db_user = await db.users.find_one({"email": user.email})
        if not db_user or not verify_password(user.password, db_user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user["email"]}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/")
def read_root():
    return {"status": "Resume Parser API is running"}
