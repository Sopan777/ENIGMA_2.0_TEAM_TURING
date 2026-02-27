"""
Chat Routes — FastAPI router for Interactive Multi-Agent Interview Chat.
Orchestrates the 5 specialized evaluation agents (Brain, Judge, Comm, Reasoning, Aggregator).
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import base64
import os
import uuid
import time
import random
import string
from openai import AsyncOpenAI

from agents.brain_agent import call_brain_agent
from agents.code_judge_agent import call_code_judge_agent
from agents.comm_eval_agent import call_comm_eval_agent
from agents.reasoning_agent import call_reasoning_agent
from agents.aggregator_agent import call_aggregator_agent
from agents.proctor_agent import ProctorAgent

router = APIRouter()
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ─── In-Memory Session Store (For Demo Purposes) ──────────────────────────
# In production, this would be a MongoDB collection
SESSION_STORE = {}

# ─── Request/Response Models ──────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    candidate_name: str
    role: str
    experience_years: int
    languages: List[str]
    problem_title: str
    difficulty_level: str
    resume_text: str = ""

class StartSessionResponse(BaseModel):
    session_id: str
    join_code: str
    message: str
    audio_base64: Optional[str] = None

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    code: str = ""
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str
    audio_base64: Optional[str] = None

class CodeSubmitRequest(BaseModel):
    session_id: str
    code: str
    language: str

class CodeSubmitResponse(BaseModel):
    status: str
    message: str

class EndSessionRequest(BaseModel):
    session_id: str

class EndSessionResponse(BaseModel):
    report: Dict[str, Any]

class ReportCheatRequest(BaseModel):
    session_id: str
    warning_type: str
    message: str
    is_terminal: bool


# ─── Utility: OpenAI TTS ─────────────────────────────────────────────────

async def generate_speech(text: str) -> Optional[str]:
    """Generate speech audio (MP3) from text using OpenAI's TTS API."""
    if not os.getenv("OPENAI_API_KEY"):
        return None

    try:
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice="nova", # Female voice instead of 'echo'
            input=text
        )
        audio_data = response.read()
        return base64.b64encode(audio_data).decode("utf-8")
    except Exception as e:
        print(f"[TTS ERROR] Failed to generate OpenAI speech: {e}")
        return None


class TTSRequest(BaseModel):
    text: str

@router.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """On-demand TTS endpoint — same OpenAI 'nova' voice used everywhere."""
    audio_b64 = await generate_speech(req.text)
    if audio_b64:
        return {"audio_base64": audio_b64}
    raise HTTPException(status_code=500, detail="TTS generation failed")


# ─── Endpoints ────────────────────────────────────────────────────────────

@router.post("/api/start-session", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest, background_tasks: BackgroundTasks):
    """
    Initializes a new interview session and generates the first AI greeting.
    """
    session_id = str(uuid.uuid4())
    join_code = ''.join(random.choices(string.digits, k=6))
    
    SESSION_STORE[session_id] = {
        "join_code": join_code,
        "candidate": {
            "name": req.candidate_name,
            "role": req.role,
            "experience_years": req.experience_years,
            "languages": req.languages,
            "interview_topic": req.problem_title,
            "difficulty_level": req.difficulty_level
        },
        "resume_text": req.resume_text,
        "phase": "warmup",
        "transcripts": [],
        "latest_code": "",
        "evaluations": {
            "code_judge": None,
            "comm_eval": None,
            "reasoning_eval": None
        },
        "proctor_agent": ProctorAgent(session_id),
        "browser_warnings": []
    }

    # Start the webcam cheating monitor loop in the background
    background_tasks.add_task(SESSION_STORE[session_id]["proctor_agent"].start_monitoring)

    payload = {
        "candidate": SESSION_STORE[session_id]["candidate"],
        "resume_text": req.resume_text,
        "phase": "warmup",
        "transcript": "Hello, I am ready to begin.",
        "code_submission": "",
        "test_results": {},
        "cheat_warnings": [],
        "context_summary": "Initial greeting. The candidate's resume has been provided. Start by asking 1-2 short questions about their resume/experience before presenting the coding problem."
    }

    # Call Brain Agent for initial greeting
    brain_resp = await call_brain_agent(payload)
    reply_text = brain_resp.get("utterance", f"Hello {req.candidate_name}, let's begin your interview.")
    
    # Generate Audio
    audio_b64 = await generate_speech(reply_text)

    return StartSessionResponse(
        session_id=session_id,
        join_code=join_code,
        message=reply_text,
        audio_base64=audio_b64
    )


@router.post("/api/chat", response_model=ChatResponse)
async def chat_with_interviewer(req: ChatRequest, background_tasks: BackgroundTasks):
    """
    Interactive chat with the AI Interviewer Brain.
    Also triggers background reasoning and communication evaluators.
    """
    if req.session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = SESSION_STORE[req.session_id]
    session["latest_code"] = req.code
    session["transcripts"].append(req.message)

    # 1. Trigger background Communication and Reasoning Evaluators
    async def evaluate_speech_async(transcript: str, session_id: str):
        # Comm Eval
        comm_res = await call_comm_eval_agent({"transcript": transcript})
        SESSION_STORE[session_id]["evaluations"]["comm_eval"] = comm_res
        
        # Reasoning Eval
        reason_res = await call_reasoning_agent({
            "approach_explanation": transcript,
            "problem": session["candidate"]["interview_topic"],
            "candidate_steps": transcript
        })
        SESSION_STORE[session_id]["evaluations"]["reasoning_eval"] = reason_res

    # Kick off evaluation of this transcript chunk in the background without blocking the chat response
    background_tasks.add_task(evaluate_speech_async, req.message, req.session_id)

    # Get any recent cheating warnings from the background proctor
    recent_warnings = session["proctor_agent"].get_warnings()
    all_warnings = recent_warnings + [w["message"] for w in session["browser_warnings"]]

    # 2. Call the Brain Agent for the next conversational turn
    payload = {
        "candidate": session["candidate"],
        "resume_text": session.get("resume_text", ""),
        "phase": "coding", # Defaulting to coding phase for now
        "transcript": req.message,
        "code_submission": req.code,
        "test_results": {},
        "cheat_warnings": all_warnings,
        "context_summary": f"Recent history size: {len(req.history)}"
    }

    brain_resp = await call_brain_agent(payload)
    reply_text = brain_resp.get("utterance", "Let's keep going.")
    
    # Generate Audio
    audio_b64 = await generate_speech(reply_text)

    return ChatResponse(reply=reply_text, audio_base64=audio_b64)


@router.post("/api/submit-code", response_model=CodeSubmitResponse)
async def submit_code(req: CodeSubmitRequest, background_tasks: BackgroundTasks):
    """
    Triggered when candidate formally submits code for testing/evaluation.
    """
    if req.session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = SESSION_STORE[req.session_id]
    session["latest_code"] = req.code

    async def run_judge_async(code: str, session_id: str):
        # Fake test results for demo integration
        test_results = {"passed": 3, "total": 5, "failed_cases": ["Edge case empty array"]}
        
        judge_res = await call_code_judge_agent({
            "code": code,
            "language": req.language,
            "problem": session["candidate"]["interview_topic"],
            "constraints": "O(N) time complexity",
            "test_results": test_results
        })
        SESSION_STORE[session_id]["evaluations"]["code_judge"] = judge_res

    background_tasks.add_task(run_judge_async, req.code, req.session_id)

    return CodeSubmitResponse(
        status="evaluating",
        message="Code submitted successfully. The judge is evaluating it."
    )


@router.post("/api/end-session", response_model=EndSessionResponse)
async def end_session(req: EndSessionRequest):
    """
    Ends the interview and compiles the final structured evaluation report via the Aggregator Agent.
    """
    if req.session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = SESSION_STORE[req.session_id]

    # Stop background monitoring thread
    proctor = session.get("proctor_agent")
    if proctor:
        proctor.stop_monitoring()

    payload = {
        "code_judge": session["evaluations"]["code_judge"] or {},
        "communication_eval": session["evaluations"]["comm_eval"] or {},
        "reasoning_eval": session["evaluations"]["reasoning_eval"] or {},
        "proctor_warnings": proctor.get_warnings() if proctor else [],
        "browser_warnings": session["browser_warnings"],
        "session_summary": f"Interview complete for {session['candidate']['name']} on {session['candidate']['interview_topic']}."
    }

    final_report = await call_aggregator_agent(payload)

    return EndSessionResponse(report=final_report)

@router.post("/api/report-cheat")
async def report_cheat(req: ReportCheatRequest):
    """
    Receives browser-level security infractions (Tab Switch, Fullscreen Exit, Paste).
    """
    if req.session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
        
    SESSION_STORE[req.session_id]["browser_warnings"].append({
        "type": req.warning_type,
        "message": req.message,
        "is_terminal": req.is_terminal,
        "timestamp": time.time()
    })

    return {"status": "recorded"}

# ─── Real-Time Code Sync ──────────────────────────────────────────────────

class SyncCodeRequest(BaseModel):
    session_id: str
    code: str

@router.post("/api/sync-code")
async def sync_code(req: SyncCodeRequest):
    """Called periodically by the candidate's editor to sync live code to the session."""
    if req.session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
    SESSION_STORE[req.session_id]["latest_code"] = req.code
    return {"status": "synced"}



@router.get("/api/session/{join_code}")
async def get_session_state(join_code: str):
    """
    Called by the Interviewer Dashboard to poll live interview state.
    """
    for sid, data in SESSION_STORE.items():
        if data.get("join_code") == join_code:
            proctor = data.get("proctor_agent")
            return {
                "candidate": data["candidate"],
                "phase": data["phase"],
                "latest_code": data["latest_code"],
                "transcripts": data["transcripts"],
                "browser_warnings": data["browser_warnings"],
                "proctor_warnings": proctor.get_warnings() if proctor else [],
                "is_active": proctor is not None and proctor.is_running
            }
            
    raise HTTPException(status_code=404, detail="Invalid Join Code or Session Ended")


# ─── MJPEG Video Feed Streaming ────────────────────────────────────────────
import asyncio

async def _generate_mjpeg_frames(session_id: str):
    """Generator that yields MJPEG frames from the proctor agent's camera feed."""
    # 1x1 black pixel JPEG as fallback when no frame is available
    BLANK_JPEG = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd2\x8a(\x03\xff\xd9'

    while True:
        session = SESSION_STORE.get(session_id)
        if not session:
            break

        proctor = session.get("proctor_agent")
        if proctor and proctor.is_running:
            frame_bytes = proctor.get_latest_frame_jpeg()
            if frame_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
            else:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + BLANK_JPEG + b"\r\n"
                )
        else:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + BLANK_JPEG + b"\r\n"
            )

        await asyncio.sleep(0.1)  # ~10 FPS


@router.get("/api/video-feed/{session_id}")
async def video_feed(session_id: str):
    """
    Streams the proctor's annotated camera feed as MJPEG.
    Use with <img src="http://localhost:8000/api/video-feed/{session_id}" />.
    """
    if session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        _generate_mjpeg_frames(session_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
