import cv2
import time
import os
import asyncio
from datetime import datetime
from ultralytics import YOLO

# Detection parameters
CONF_THRESHOLD = 0.4
SUSPICIOUS_TIME = 3  # seconds
LOG_DIR = "logs"
EVIDENCE_DIR = "evidence"

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(EVIDENCE_DIR, exist_ok=True)

try:
    model = YOLO("yolov8n.pt")
except Exception as e:
    print(f"[PROCTOR WARNING] Could not load YOLO model: {e}")
    model = None

class ProctorAgent:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.is_running = False
        self.behavior_tracker = {}
        self.warnings = []
        self._cap = None
        self.latest_frame = None  # Shared frame for video streaming

    def classify_behavior(self, x1, y1, x2, y2):
        w = x2 - x1
        h = y2 - y1
        if w > h * 0.9:
            return "Leaning"
        elif h > w * 1.6:
            return "Looking Around"
        else:
            return "Normal"

    def track_behavior(self, student_id, behavior):
        current_time = time.time()
        if student_id not in self.behavior_tracker:
            self.behavior_tracker[student_id] = {
                "behavior": behavior,
                "start": current_time
            }
            return 0
        if self.behavior_tracker[student_id]["behavior"] == behavior:
            return current_time - self.behavior_tracker[student_id]["start"]
        else:
            self.behavior_tracker[student_id] = {
                "behavior": behavior,
                "start": current_time
            }
            return 0

    def log_cheating(self, frame, behavior):
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        img_path = os.path.join(EVIDENCE_DIR, f"{self.session_id}_{timestamp}.jpg")
        cv2.imwrite(img_path, frame)
        
        # We append to warnings so the orchestrator can read it
        warning_msg = f"Candidate exhibited sustained '{behavior}' at {timestamp}."
        if warning_msg not in self.warnings:
             self.warnings.append(warning_msg)

    async def start_monitoring(self):
        """Runs the OpenCV camera loop safely without blocking FastAPI."""
        if not model:
            print("[PROCTOR AGENT] YOLO model missing. Proctoring disabled.")
            return

        self.is_running = True
        # Note: In a real server environment, cv2.VideoCapture(0) opens the server's webcam.
        # This implementation assumes the student/candidate is running the backend locally for demo.
        self._cap = cv2.VideoCapture(0)
        
        while self.is_running and self._cap.isOpened():
            ret, frame = self._cap.read()
            if not ret:
                await asyncio.sleep(0.1)
                continue
                
            frame = cv2.flip(frame, 1)
            results = model(frame, conf=CONF_THRESHOLD, verbose=False)
            
            for r in results:
                for box in r.boxes:
                    if int(box.cls[0]) != 0: # 0 is person
                        continue
                        
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    behavior = self.classify_behavior(x1, y1, x2, y2)
                    duration = self.track_behavior(self.session_id, behavior)
                    
                    # Draw visual bounding box for local debug window
                    color = (0, 255, 0) # Green normal
                    if behavior == "Leaning":
                        color = (0, 165, 255) # Orange
                    elif behavior == "Looking Around":
                        color = (0, 0, 255) # Red
                        
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, behavior, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    if duration > SUSPICIOUS_TIME and behavior != "Normal":
                        # Mark red if recording cheat
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        self.log_cheating(frame, behavior)

            # Show the diagnostic window locally
            cv2.imshow("Proctoring Integrity Monitor (AI Interviewer)", frame)
            cv2.waitKey(1) # Required for cv2.imshow to update

            # Store the latest annotated frame for MJPEG streaming
            self.latest_frame = frame.copy()

            # Prevent CPU hogging in the background thread
            await asyncio.sleep(0.1) # Faster update rate for smoother video

        if self._cap:
            self._cap.release()
            cv2.destroyAllWindows()

    def stop_monitoring(self):
        self.is_running = False
        if self._cap:
             self._cap.release()
        cv2.destroyAllWindows()

    def get_warnings(self):
        return self.warnings

    def get_latest_frame_jpeg(self):
        """Returns the latest annotated frame as JPEG bytes for streaming."""
        if self.latest_frame is None:
            return None
        _, buffer = cv2.imencode('.jpg', self.latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return buffer.tobytes()
