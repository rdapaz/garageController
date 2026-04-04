from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import RPi.GPIO as GPIO
import time
import paho.mqtt.client as mqtt
import asyncio
import sqlite3
from datetime import datetime, timedelta
import threading
from typing import Optional

app = FastAPI()

# Database setup
def init_db():
    conn = sqlite3.connect('garage.db')
    c = conn.cursor()
    
    # Garage events table
    c.execute('''CREATE TABLE IF NOT EXISTS garage_events
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  status TEXT NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # LPR events table
    c.execute('''CREATE TABLE IF NOT EXISTS lpr_events
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  plate_number TEXT NOT NULL,
                  action TEXT NOT NULL,
                  garage_status_before TEXT NOT NULL,
                  garage_status_after TEXT,
                  authorized BOOLEAN NOT NULL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # Authorized plates table
    c.execute('''CREATE TABLE IF NOT EXISTS authorized_plates
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  plate_number TEXT NOT NULL UNIQUE,
                  owner_name TEXT,
                  active BOOLEAN DEFAULT 1,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    conn.commit()
    conn.close()

init_db()

# Pydantic models
class LPRDetection(BaseModel):
    plate_number: str
    confidence: float = 1.0

class AuthorizedPlate(BaseModel):
    plate_number: str
    owner_name: str = ""

class UniFiWebhook(BaseModel):
    type: str
    license_plate: Optional[str] = None
    camera: Optional[str] = None
    timestamp: Optional[int] = None

def normalize_plate(plate):
    """Strip hyphens, spaces, and uppercase for consistent matching"""
    return plate.replace("-", "").replace(" ", "").upper()

class GarageDoorController:
    def __init__(self):
        GPIO.setmode(GPIO.BCM)
        self.TRIGGER = 16
        self.ECHO = 26
        self.RELAY_OUT = 24
        self.DELAY = 12
        GPIO.setwarnings(False)
        GPIO.setup(self.TRIGGER, GPIO.OUT)
        GPIO.setup(self.ECHO, GPIO.IN)
        GPIO.setup(self.RELAY_OUT, GPIO.OUT)
        
        self.current_status = "Unknown"
        self.connected_websockets = set()
        self.pending_close_task = None
        self.pending_close_plate = None
        self.close_countdown = 0
        
        # MQTT setup (optional - won't crash if broker unavailable)
        self.mqtt_client = mqtt.Client()
        try:
            self.mqtt_client.connect("localhost", 1883, 60)
            self.mqtt_client.loop_start()
            self.mqtt_connected = True
            print("[MQTT] Connected to broker")
        except Exception as e:
            self.mqtt_connected = False
            print(f"[MQTT] Broker unavailable, continuing without MQTT: {e}")
        
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
        
        timeout = time.time() + 1
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
    
    def record_status_change(self, status):
        with sqlite3.connect('garage.db') as conn:
            c = conn.cursor()
            c.execute("INSERT INTO garage_events (status) VALUES (?)", (status,))
            conn.commit()
    
    def get_last_10_events(self):
        with sqlite3.connect('garage.db') as conn:
            c = conn.cursor()
            c.execute("SELECT status, timestamp FROM garage_events ORDER BY timestamp DESC LIMIT 10")
            return c.fetchall()
    
    def is_plate_authorized(self, plate_number):
        with sqlite3.connect('garage.db') as conn:
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM authorized_plates WHERE plate_number = ? AND active = 1", 
                     (plate_number,))
            return c.fetchone()[0] > 0
    
    def is_plate_in_cooldown(self, plate_number):
        # Check in-memory cooldown (simplification - could use DB)
        return False  # For now, disabled cooldown check
    
    def record_lpr_event(self, plate_number, action, status_before, status_after, authorized):
        with sqlite3.connect('garage.db') as conn:
            c = conn.cursor()
            c.execute("""INSERT INTO lpr_events 
                        (plate_number, action, garage_status_before, garage_status_after, authorized) 
                        VALUES (?, ?, ?, ?, ?)""",
                     (plate_number, action, status_before, status_after, authorized))
            conn.commit()
        
        # Publish to MQTT
        if self.mqtt_connected:
            self.mqtt_client.publish("garage/lpr", f"{plate_number}:{action}:{authorized}")
    
    async def auto_close_with_countdown(self, plate_number, delay_seconds=60):
        """Wait with countdown then close garage if still open"""
        try:
            self.close_countdown = delay_seconds
            
            # Send countdown updates every 10 seconds
            while self.close_countdown > 0:
                # Notify clients of countdown
                await self.broadcast_lpr_status({
                    "action": "countdown",
                    "plate": plate_number,
                    "seconds_remaining": self.close_countdown
                })
                
                # Wait 10 seconds or until countdown reaches 0
                wait_time = min(10, self.close_countdown)
                await asyncio.sleep(wait_time)
                self.close_countdown -= wait_time
            
            # Check if door is still open
            if self.current_status == "Open":
                print(f"[LPR] Auto-closing garage for {plate_number}")
                self.toggle_garage()
                self.record_lpr_event(plate_number, "auto_close", "Open", "Closed", True)
                if self.mqtt_connected:
                    self.mqtt_client.publish("garage/lpr/auto_closed", plate_number)
            else:
                print(f"[LPR] Garage already closed, skipping")
            
            self.close_countdown = 0
            self.pending_close_plate = None
            
        except asyncio.CancelledError:
            print(f"[LPR] Auto-close cancelled for {plate_number}")
            self.close_countdown = 0
            self.pending_close_plate = None
            await self.broadcast_lpr_status({
                "action": "cancelled",
                "plate": plate_number
            })
    
    async def broadcast_lpr_status(self, data):
        """Broadcast LPR status to all connected websockets"""
        for websocket in self.connected_websockets:
            try:
                await websocket.send_json({"type": "lpr_status", "data": data})
            except Exception as e:
                print(f"Error sending LPR status: {e}")
    
    async def handle_lpr_detection(self, plate_number):
        """Main LPR logic"""
        plate_number = normalize_plate(plate_number)

        # Check authorization
        if not self.is_plate_authorized(plate_number):
            print(f"[LPR] UNAUTHORIZED plate: {plate_number}")
            self.record_lpr_event(plate_number, "rejected", self.current_status, None, False)
            if self.mqtt_connected:
                self.mqtt_client.publish("garage/lpr/unauthorized", plate_number)
            await self.broadcast_lpr_status({
                "action": "unauthorized",
                "plate": plate_number
            })
            return {"status": "unauthorized", "message": f"Plate {plate_number} not authorized"}
        
        # Cancel any pending auto-close
        if self.pending_close_task and not self.pending_close_task.done():
            self.pending_close_task.cancel()
            print("[LPR] Cancelled pending auto-close due to new detection")
        
        current = self.current_status
        
        if current == "Closed":
            # OPEN IMMEDIATELY
            print(f"[LPR] Opening garage for {plate_number}")
            self.toggle_garage()
            self.record_lpr_event(plate_number, "open_immediate", "Closed", "Open", True)
            if self.mqtt_connected:
                self.mqtt_client.publish("garage/lpr/opened", plate_number)
            await self.broadcast_lpr_status({
                "action": "opened",
                "plate": plate_number
            })
            return {"status": "opened", "message": "Garage opened immediately"}
            
        elif current == "Open":
            # SCHEDULE AUTO-CLOSE
            print(f"[LPR] Scheduling close for {plate_number}")
            self.pending_close_plate = plate_number
            self.pending_close_task = asyncio.create_task(
                self.auto_close_with_countdown(plate_number, 60)
            )
            self.record_lpr_event(plate_number, "close_scheduled", "Open", "Pending", True)
            if self.mqtt_connected:
                self.mqtt_client.publish("garage/lpr/close_scheduled", plate_number)
            await self.broadcast_lpr_status({
                "action": "close_scheduled",
                "plate": plate_number,
                "seconds": 60
            })
            return {"status": "close_scheduled", "message": "Garage will close in 60 seconds"}
        
        return {"status": "error", "message": f"Unknown status: {current}"}
    
    def cancel_auto_close(self):
        """Cancel pending auto-close"""
        if self.pending_close_task and not self.pending_close_task.done():
            self.pending_close_task.cancel()
            plate = self.pending_close_plate
            self.pending_close_plate = None
            self.close_countdown = 0
            print(f"[LPR] Auto-close cancelled by user for {plate}")
            return True
        return False
    
    def monitor_status(self):
        while True:
            new_status = self.get_garage_status()
            if new_status != self.current_status:
                old_status = self.current_status
                self.current_status = new_status
                self.record_status_change(new_status)
                if self.mqtt_connected:
                    self.mqtt_client.publish("garage/status", new_status)
                
                # If door was manually closed during pending auto-close, cancel it
                if new_status == "Closed" and self.pending_close_task and not self.pending_close_task.done():
                    self.pending_close_task.cancel()
                    print("Door manually closed, cancelled auto-close task")
                
                asyncio.run(self.notify_clients(new_status))
            time.sleep(1)
    
    async def notify_clients(self, status):
        events = self.get_last_10_events()
        for websocket in self.connected_websockets:
            try:
                await websocket.send_json({
                    "type": "status_update",
                    "status": status, 
                    "events": events,
                    "countdown": self.close_countdown,
                    "pending_close_plate": self.pending_close_plate
                })
            except Exception as e:
                print(f"Error sending to websocket: {e}")
    
    def toggle_garage(self):
        GPIO.output(self.RELAY_OUT, True)
        time.sleep(self.DELAY)
        GPIO.output(self.RELAY_OUT, GPIO.LOW)
        return self.current_status

controller = GarageDoorController()

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    controller.connected_websockets.add(websocket)
    try:
        events = controller.get_last_10_events()
        await websocket.send_json({
            "type": "status_update",
            "status": controller.current_status, 
            "events": events,
            "countdown": controller.close_countdown,
            "pending_close_plate": controller.pending_close_plate
        })
        while True:
            await websocket.receive_text()
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        controller.connected_websockets.remove(websocket)

# Existing garage endpoints
@app.get("/api/status")
async def get_status():
    return {
        "status": controller.current_status,
        "countdown": controller.close_countdown,
        "pending_close_plate": controller.pending_close_plate
    }

@app.get("/api/events")
async def get_events():
    return {"events": controller.get_last_10_events()}

@app.post("/api/toggle")
async def toggle_garage():
    new_status = controller.toggle_garage()
    events = controller.get_last_10_events()
    return {"status": new_status, "events": events}

# LPR endpoints
@app.post("/api/lpr/detect")
async def lpr_detect(detection: LPRDetection):
    """Receive LPR detection"""
    result = await controller.handle_lpr_detection(detection.plate_number)
    return result

@app.get("/api/lpr/unifi-webhook")
async def unifi_webhook_get(plate: str = None):
    """Handle UniFi Protect webhook via GET with query param: ?plate=ABC123"""
    if plate:
        result = await controller.handle_lpr_detection(plate)
        return result
    return {"status": "error", "message": "No plate number provided. Use ?plate=ABC123"}

@app.post("/api/lpr/unifi-webhook")
async def unifi_webhook_post(webhook: dict):
    """Handle UniFi Protect webhook via POST with JSON body"""
    plate = None
    if "license_plate" in webhook:
        plate = webhook["license_plate"]
    elif "licensePlate" in webhook:
        plate = webhook["licensePlate"]
    elif "plate" in webhook:
        plate = webhook["plate"]

    if plate:
        result = await controller.handle_lpr_detection(plate)
        return result

    return {"status": "error", "message": "No plate number in webhook body"}

@app.post("/api/lpr/cancel")
async def cancel_auto_close():
    """Cancel pending auto-close"""
    cancelled = controller.cancel_auto_close()
    if cancelled:
        await controller.broadcast_lpr_status({"action": "cancelled_by_user"})
        return {"status": "success", "message": "Auto-close cancelled"}
    return {"status": "error", "message": "No pending auto-close"}

@app.post("/api/lpr/plates")
async def add_authorized_plate(plate: AuthorizedPlate):
    """Add authorized plate"""
    normalized = normalize_plate(plate.plate_number)
    try:
        with sqlite3.connect('garage.db') as conn:
            c = conn.cursor()
            c.execute("""INSERT INTO authorized_plates (plate_number, owner_name)
                        VALUES (?, ?)""", (normalized, plate.owner_name))
            conn.commit()
        return {"status": "success", "message": f"Plate {normalized} added"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Plate already exists")

@app.get("/api/lpr/plates")
async def get_authorized_plates():
    """Get all authorized plates"""
    with sqlite3.connect('garage.db') as conn:
        c = conn.cursor()
        c.execute("SELECT plate_number, owner_name, active, created_at FROM authorized_plates ORDER BY created_at DESC")
        plates = [{"plate": row[0], "owner": row[1], "active": bool(row[2]), "created_at": row[3]} 
                 for row in c.fetchall()]
    return {"plates": plates}

@app.delete("/api/lpr/plates/{plate_number}")
async def remove_authorized_plate(plate_number: str):
    """Deactivate authorized plate"""
    normalized = normalize_plate(plate_number)
    with sqlite3.connect('garage.db') as conn:
        c = conn.cursor()
        c.execute("UPDATE authorized_plates SET active = 0 WHERE plate_number = ?", (normalized,))
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plate not found")
        conn.commit()
    return {"status": "success", "message": f"Plate {plate_number} deactivated"}

@app.get("/api/lpr/events")
async def get_lpr_events(limit: int = 20):
    """Get recent LPR events"""
    with sqlite3.connect('garage.db') as conn:
        c = conn.cursor()
        c.execute("""SELECT plate_number, action, garage_status_before, 
                    garage_status_after, authorized, timestamp 
                    FROM lpr_events ORDER BY timestamp DESC LIMIT ?""", (limit,))
        events = [{"plate": row[0], "action": row[1], "before": row[2], 
                  "after": row[3], "authorized": bool(row[4]), "timestamp": row[5]} 
                 for row in c.fetchall()]
    return {"events": events}

# Serve React app
app.mount("/", StaticFiles(directory="/home/pi/garageController/frontend", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        GPIO.cleanup()
        if controller.mqtt_connected:
            controller.mqtt_client.loop_stop()
            controller.mqtt_client.disconnect()