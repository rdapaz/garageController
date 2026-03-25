# Raspberry Pi Garage Door Controller

A web-based garage door controller using a Raspberry Pi, ultrasonic sensor (HC-SR04), and relay module. Features real-time status monitoring, event logging with source tracking, dark mode, and WebSocket-based live updates.

## Features

- Real-time garage door status monitoring via ultrasonic sensor
- React frontend with Tailwind CSS and dark mode support
- SQLAlchemy ORM with event source tracking (remote sensor vs app-triggered)
- Timezone-aware timestamps (AWST)
- WebSocket support for live status updates
- Mobile-responsive design
- Nginx reverse proxy with WebSocket passthrough

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
|   +-- uwsgi.ini                  # uWSGI configuration
|   +-- garage-controller.service  # systemd service file
|   +-- requirements.txt           # Python dependencies
+-- src/                           # React source (App.js, index.js, etc.)
+-- public/                        # Static assets
+-- nginx/
|   +-- sites-available            # Nginx site configuration
+-- setup/
|   +-- install.sh                 # Automated installation script
|   +-- setup_database.sh          # Database initialisation script
+-- package.json                   # Node.js dependencies
+-- tailwind.config.js             # Tailwind CSS configuration
```

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

Transfer the `build` folder to `/home/pi/garageController/build` on your Raspberry Pi.

### 4. Configure

Update paths in the following files if needed:

- `backend/main.py`: Update the StaticFiles directory path
- `backend/uwsgi.ini`: Update the chdir path
- `backend/garage-controller.service`: Update WorkingDirectory and paths
- `nginx/sites-available`: Update server_name and paths

### 5. Start the Service

```bash
sudo systemctl start garage-controller
sudo systemctl status garage-controller
```

## Usage

Access the web interface at `http://your-pi-ip-address` or `http://garagecontroller.local`

## Troubleshooting

### Check Service Status

```bash
sudo systemctl status garage-controller
```

### View Logs

```bash
sudo journalctl -u garage-controller -n 50
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/garage-controller-error.log
```

### Restart Services

```bash
sudo systemctl restart garage-controller
sudo systemctl restart nginx
```

## Setting Static IP

```bash
sudo nmcli connection modify "Your-WiFi-SSID" ipv4.addresses 192.168.1.100/24 ipv4.gateway 192.168.1.1 ipv4.dns "8.8.8.8" ipv4.method manual
sudo nmcli connection down "Your-WiFi-SSID"
sudo nmcli connection up "Your-WiFi-SSID"
```

## Licence

MIT
