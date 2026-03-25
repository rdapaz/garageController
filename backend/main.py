from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import RPi.GPIO as GPIO
import time
import asyncio
from pydantic import BaseModel
import threading
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import pytz

awst = pytz.timezone('Australia/Perth')
app = FastAPI()

# SQLite3 setup
DATABASE_URL = "sqlite:///./garage_status.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Create database table for status events
class StatusEvent(Base):
    __tablename__ = "status_events"
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, index=True)
    source = Column(String, index=True)  # New column to track source (remote or app)
    timestamp = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


class GarageDoorController:
    def __init__(self):
        GPIO.setmode(GPIO.BCM)
        self.TRIGGER = 16
        self.ECHO = 26
        self.RELAY_OUT = 24
        self.DELAY = 15
        GPIO.setwarnings(False)
        GPIO.setup(self.TRIGGER, GPIO.OUT)
        GPIO.setup(self.ECHO, GPIO.IN)
        GPIO.setup(self.RELAY_OUT, GPIO.OUT)

        self.current_status = "Unknown"
        self.last_event = None  # Track the last status event
        self.connected_websockets = set()

        # Start continuous monitoring
        threading.Thread(target=self.monitor_status, daemon=True).start()

    def get_distance(self):
        GPIO.output(self.TRIGGER, False)
        time.sleep(0.5)
        GPIO.output(self.TRIGGER, True)
        time.sleep(0.00001)
        GPIO.output(self.TRIGGER, False)

        pulse_start = time.time()
        pulse_end = time.time()

        timeout = time.time() + 1  # 1 second timeout
        while GPIO.input(self.ECHO) == 0:
            pulse_start = time.time()
            if pulse_start > timeout:
                return None

        while GPIO.input(self.ECHO) == 1:
            pulse_end = time.time()
            if pulse_end > timeout:
                return None

        return 17150.0 * (pulse_end - pulse_start)

    def get_garage_status(self):
        distance = self.get_distance()
        if distance is None:
            return "Error: Sensor timeout"
        return "Closed" if distance > 10 else "Open"

    def monitor_status(self):
        # Continuously monitor the garage door status
        while True:
            new_status = self.get_garage_status()
            if new_status != self.current_status:
                self.current_status = new_status
                # Only save and notify if this status change is different from the last saved event
                if not self.last_event or self.last_event.status != new_status:
                    self.last_event = self.save_status_to_db(new_status, "remote")
                    asyncio.run(self.notify_clients(new_status))
            time.sleep(1)  # Check every second

    def save_status_to_db(self, status, source):
        # Save status event in the database with the given source
        db = SessionLocal()
        status_event = StatusEvent(status=status, source=source)
        db.add(status_event)
        db.commit()
        db.refresh(status_event)
        db.close()
        return status_event  # Return the saved event for comparison

    async def notify_clients(self, status):
        # Notify all connected WebSocket clients of the new status
        for websocket in self.connected_websockets:
            await websocket.send_json({"status": status})

    def toggle_garage(self):
        # Trigger garage door relay and log the event as triggered by the app
        GPIO.output(self.RELAY_OUT, True)
        time.sleep(self.DELAY)
        GPIO.output(self.RELAY_OUT, GPIO.LOW)
        
        # Check if the current status is different from the last event and save it
        if not self.last_event or self.last_event.status != self.current_status:
            self.last_event = self.save_status_to_db(self.current_status, "app")
        return self.current_status


controller = GarageDoorController()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # WebSocket endpoint to manage client connections
    await websocket.accept()
    controller.connected_websockets.add(websocket)
    try:
        while True:
            # Send the current status on connection
            await websocket.send_json({"status": controller.current_status})
            await websocket.receive_text()  # Keep the connection alive by receiving ping
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        controller.connected_websockets.remove(websocket)


@app.get("/api/status")
async def get_status():
    # API to return the current status of the garage door
    return {"status": controller.current_status}


@app.post("/api/toggle")
async def toggle_garage():
    # API to toggle the garage door and log the event
    new_status = controller.toggle_garage()
    return {"status": new_status}


@app.get("/api/events")
async def get_last_events():
    # API to fetch the last 10 status events
    db = SessionLocal()
    events = db.query(StatusEvent).order_by(StatusEvent.timestamp.desc()).limit(10).all()
    db.close()
    return [{
        "status": event.status,
        "source": event.source,
        "timestamp": event.timestamp.replace(tzinfo=pytz.UTC).astimezone(awst).strftime('%Y-%m-%d %H:%M:%S')
    } for event in events]


# Serve the React app
app.mount("/", StaticFiles(directory="/home/pi/garageController/frontend", html=True), name="static")
