#!/bin/bash
# Installation script for Garage Controller

echo "Starting Garage Controller installation..."

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required system packages
echo "Installing system dependencies..."
sudo apt install -y python3-venv python3-pip nginx mosquitto mosquitto-clients

# Create project directory
echo "Creating project directory..."
mkdir -p /home/pi/garageController
cd /home/pi/garageController

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv /home/pi/venv

# Activate virtual environment and install Python packages
echo "Installing Python dependencies..."
source /home/pi/venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn paho-mqtt RPi.GPIO uwsgi

# Setup database
echo "Setting up database..."
bash setup_database.sh

# Copy systemd service file
echo "Setting up systemd service..."
sudo cp garage-controller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable garage-controller

# Setup Nginx
echo "Configuring Nginx..."
sudo cp garage-controller /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/garage-controller /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Start the service
echo "Starting garage controller service..."
sudo systemctl start garage-controller

echo "Installation complete!"
echo "You can check the status with: sudo systemctl status garage-controller"