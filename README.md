# Raspberry Pi Garage Door Controller

A web-based garage door controller using a Raspberry Pi, ultrasonic sensor (HC-SR04), and relay module. Integrates with UniFi Protect for automatic licence plate recognition (LPR) to open and close the garage door when authorised vehicles are detected.

## Features

- Real-time garage door status monitoring via ultrasonic sensor
- **UniFi Protect LPR integration** via webhook (auto-open/close on plate detection)
- **Authorised plate management** with web UI and API
- **Plate normalisation** (hyphens, spaces, and case are stripped automatically)
- **Auto-close countdown** (60s) with cancellable WebSocket notifications
- **JWT authentication** with bcrypt password hashing and rate-limited login
- **Dark mode** with Sun/Moon toggle (persisted in localStorage)
- React frontend with Tailwind CSS and custom garage door SVG icons
- Timezone-aware timestamps (UTC storage, local display in en-AU)
- WebSocket support for live status updates (auto-detects ws/wss)
- **HTTPS support** via self-signed certificate for reverse proxy re-encryption
- Optional MQTT integration for Home Assistant / monitoring
- Nginx reverse proxy with HTTP and HTTPS + WebSocket passthrough
- Mobile-responsive design

## Hardware Requirements

- Raspberry Pi (tested on Pi 3A+)
- HC-SR04 Ultrasonic Sensor
- Relay Module
- Garage door opener

## GPIO Pin Configuration

| Pin     | GPIO |
|---------|------|
| TRIGGER | 16   |
| ECHO    | 26   |
| RELAY   | 24   |

## Software Requirements

- Raspberry Pi OS (Debian-based)
- Python 3.6+
- Node.js 14+ (for building the frontend)
- Nginx

## Project Structure

```
.
+-- backend/
|   +-- main.py                    # FastAPI application
|   +-- uwsgi.ini                  # uWSGI configuration (legacy)
|   +-- garage-controller.service  # systemd service file (legacy)
|   +-- requirements.txt           # Python dependencies
+-- src/                           # React source (App.js, index.js, etc.)
+-- public/                        # Static assets
+-- nginx/
|   +-- sites-available            # Nginx site configuration
+-- setup/
|   +-- install.sh                 # Automated installation script
|   +-- setup_database.sh          # Database initialisation script
|   +-- LPR_Setup_Guide.docx      # UniFi Protect LPR setup guide
+-- package.json                   # Node.js dependencies
+-- tailwind.config.js             # Tailwind CSS configuration
```

## Architecture

```
Browser :80 --> Nginx --> uvicorn :8080 --> FastAPI (main.py)
                                              |
UniFi Protect ---> GET /api/lpr/unifi-webhook?plate=ABC123
                                              |
                                         garage.db (SQLite)
```

- **Nginx** listens on port 80, proxies HTTP and WebSocket traffic to uvicorn on port 8080
- **Uvicorn** runs the FastAPI app from `/home/pi/garageController`
- **React build** is served from `/home/pi/garageController/frontend`
- **SQLite** stores events, authorised plates, and LPR history (timestamps in UTC)

## UniFi Protect LPR Integration

The garage controller integrates with UniFi Protect cameras that support licence plate recognition. When an authorised plate is detected, the garage door opens or schedules an auto-close automatically.

### How It Works

1. UniFi Protect detects a licence plate via the G6 Bullet camera
2. An Alarm Manager rule fires a webhook to the Raspberry Pi
3. The garage controller checks if the plate is authorised
4. **Door closed + authorised plate** = door opens immediately
5. **Door open + authorised plate** = 60-second auto-close countdown starts
6. **Unauthorised plate** = event logged, no action taken

### Webhook Endpoint

The primary endpoint for UniFi Protect is a simple GET request with the plate as a query parameter:

```
GET http://192.168.1.143/api/lpr/unifi-webhook?plate=ABC123
```

A POST endpoint is also available for JSON payloads:

```bash
curl -X POST http://192.168.1.143/api/lpr/unifi-webhook \
  -H "Content-Type: application/json" \
  -d '{"plate": "ABC123"}'
```

### UniFi Protect Setup

1. Enable LPR on your camera (Settings > Smart Detections > Licence Plate)
2. Register your vehicle as a Known Vehicle via Find Anything
3. Create an Alarm in Alarm Manager with Vehicle ID trigger
4. Set the action to Custom Webhook with the GET URL above
5. See `setup/LPR_Setup_Guide.docx` for detailed instructions

### Plate Normalisation

Plate numbers are automatically normalised before storage and comparison. Hyphens, spaces, and lowercase characters are stripped:

- `ABC-123`, `abc 123`, and `ABC123` all resolve to `ABC123`
- This applies to plates added via the web UI, API, and incoming webhooks

## API Reference

### Garage Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Current door status, countdown, pending plate |
| POST | `/api/toggle` | Toggle the garage door |
| GET | `/api/events` | Last 10 status events |

### LPR Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lpr/unifi-webhook?plate=XXX` | Webhook for UniFi Protect |
| POST | `/api/lpr/unifi-webhook` | Webhook (JSON body) |
| POST | `/api/lpr/detect` | Manual LPR test |
| GET | `/api/lpr/plates` | List authorised plates |
| POST | `/api/lpr/plates` | Add authorised plate |
| DELETE | `/api/lpr/plates/{plate}` | Remove authorised plate |
| GET | `/api/lpr/events?limit=20` | LPR event history |
| POST | `/api/lpr/cancel` | Cancel pending auto-close |

### WebSocket

Connect to `ws://192.168.1.143/ws` for real-time updates including status changes, LPR events, and auto-close countdown notifications.

## MQTT (Optional)

If Mosquitto is running on `localhost:1883`, the app publishes to:

| Topic | Payload |
|-------|---------|
| `garage/status` | `Open` or `Closed` |
| `garage/lpr/opened` | Plate number |
| `garage/lpr/close_scheduled` | Plate number |
| `garage/lpr/auto_closed` | Plate number |
| `garage/lpr/unauthorized` | Plate number |

If the broker is unavailable, the app starts normally without MQTT.

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rdapaz/garageController.git
cd garageController
```

### 2. Run Installation Script

```bash
chmod +x setup/install.sh
./setup/install.sh
```

### 3. Build Frontend

On your development machine (with Node.js installed):

```bash
npm install
npm run build
```

Transfer the `build` folder contents to `/home/pi/garageController/frontend` on your Raspberry Pi.

### 4. Configure

Update paths in the following files if needed:

- `backend/main.py`: Update the StaticFiles directory path
- `nginx/sites-available`: Update server_name and proxy_pass port

### 5. Start the Service

```bash
cd /home/pi/garageController
nohup /home/pi/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 > /tmp/uvicorn.log 2>&1 &
```

> **Note:** The legacy uWSGI service (`garage-controller.service`) should be stopped and disabled. Only one instance of the app should run at a time to avoid SQLite database locking errors.

### 6. HTTPS Setup (for external access via reverse proxy)

If exposing the controller through a reverse proxy with SSL re-encryption (e.g., Kemp LoadMaster), generate a self-signed certificate:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/garage.key \
  -out /etc/nginx/ssl/garage.crt \
  -subj "/CN=gge.ricdeez.com"
```

Add an SSL server block to nginx (`/etc/nginx/sites-enabled/default`):

```nginx
server {
    listen 443 ssl;
    server_name gge.ricdeez.com;

    ssl_certificate /etc/nginx/ssl/garage.crt;
    ssl_certificate_key /etc/nginx/ssl/garage.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

The frontend automatically detects `https:` and uses `wss://` for WebSocket connections.

## Usage

- **Local access:** `http://192.168.1.143`
- **External access:** `https://gge.ricdeez.com` (via Cloudflare + Kemp LB)
- **Default credentials:** `admin` / `changeme` (change on first login)

## Troubleshooting

### Check Application Logs

```bash
cat /tmp/uvicorn.log
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/garage-controller-error.log
```

### Restart Services

```bash
sudo pkill -f uvicorn
cd /home/pi/garageController
nohup /home/pi/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 > /tmp/uvicorn.log 2>&1 &
sudo systemctl restart nginx
```

### Database Locked Errors

If you see `sqlite3.OperationalError: database is locked`, ensure only one instance is running:

```bash
sudo ss -tlnp | grep -E ":8000|:8080"
sudo systemctl stop garage-controller && sudo systemctl disable garage-controller
sudo pkill -f uwsgi
```

### Webhook Not Triggering

1. Test the endpoint manually: `curl "http://192.168.1.143/api/lpr/unifi-webhook?plate=TEST123"`
2. Check the plate is in the authorised list: `curl http://192.168.1.143/api/lpr/plates`
3. Review LPR events: `curl http://192.168.1.143/api/lpr/events`

## Setting Static IP

```bash
sudo nmcli connection modify "Your-WiFi-SSID" ipv4.addresses 192.168.1.100/24 ipv4.gateway 192.168.1.1 ipv4.dns "8.8.8.8" ipv4.method manual
sudo nmcli connection down "Your-WiFi-SSID"
sudo nmcli connection up "Your-WiFi-SSID"
```

## Licence

MIT
