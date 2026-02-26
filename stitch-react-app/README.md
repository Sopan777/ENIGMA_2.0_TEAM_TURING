# InterviewAI

InterviewAI is a minimalist, AI-powered technical interview simulation platform. Built with React, Tailwind CSS, FastAPI, and Google's Gemini AI, it parses uploaded resumes to generate highly tailored Data Structures & Algorithms (DSA) problems and behavioral questions, complete with a built-in code editor and automated grading system.

## Features

- **Resume Intelligence & Parsing:** Upload a PDF resume. The Python backend extracts text and summarizes your key technical skills.
- **Dynamic AI Problem Generation:** Gemini AI generates customized DSA problems or behavioral questions based strictly on the extracted context from your resume.
- **Integrated Code Editor:** A split-pane UI featuring problem instructions on the left and a functional code editor on the right for an immersive technical interview experience.
- **Automated Solutions Evaluation:** Submit your code within the "Active Interview" session. Gemini evaluates your solution for correctness, edge cases, and time/space complexity, returning immediate Pass/Fail feedback.
- **Anti-Cheat Tab Switching Verification:** A built-in proctoring system that tracks visibility changes. If a user switches tabs or minimizes the window 4 times during an active interview, the session is forcefully terminated.
- **Comprehensive Dashboard:** An intelligent dashboard providing:
  - **Candidate Overview:** Readiness tracking and recent activity logs.
  - **Resume Hub:** A parsed skill cloud and gap analysis based on uploaded resumes.
  - **Interview Arena:** Quick links to mock sessions and upcoming schedules.
  - **Feedback Insights:** Vibe checks, filler word tracking, and AI transcript critiques.
- **Aesthetic UI:** A visually stunning, minimalist interface leveraging Tailwind CSS v4, glassmorphism, smooth animations, and subtle glow accents.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS v4
- **Backend:** Python, FastAPI, Uvicorn
- **AI Integration:** Google GenAI SDK (`google-genai` pip package)
- **PDF Extraction:** python `pdfplumber`

---

## Local Development Workflow

To run this application locally, you must start both the React frontend and the Python backend concurrently.

### 1. Start the React Frontend

The frontend is built using Vite.

```bash
# Navigate to the frontend directory
cd stitch-react-app

# Install dependencies (if you haven't already)
npm install

# Start the Vite development server
npm run dev
```

The frontend will typically run on `http://localhost:5173`.

### 2. Start the Python FastAPI Backend

The backend handles resume parsing and all Gemini AI communication. You need to provide your Gemini API key in the `main.py` file or via an environment variable before starting.

```bash
# Navigate to the backend directory
cd python-backend

# Install required packages (if you haven't already)
pip install fastapi uvicorn pdfplumber google-genai python-multipart

# Start the FastAPI server with hot-reloading
uvicorn main:app --reload --port 8000
```

The backend API will run on `http://localhost:8000`.

### 3. Usage & Access

1. Open your browser to the frontend URL (e.g., `http://localhost:5173`).
2. Log in using the dummy credentials:
   - **Username:** `admin`
   - **Password:** `12345678`
3. Explore the **Dashboard** metrics.
4. Navigate to the **Practice** tab to upload a PDF resume, initiate a system check, and start a mock AI interview session.
