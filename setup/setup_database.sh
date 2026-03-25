#!/bin/bash
# Database setup script for Garage Controller

echo "Setting up SQLite database for Garage Controller..."

# Navigate to the application directory
cd /home/pi/garageController

# Create the database if it doesn't exist
python3 << EOF
import sqlite3

conn = sqlite3.connect('garage.db')
c = conn.cursor()

# Create the garage_events table
c.execute('''CREATE TABLE IF NOT EXISTS garage_events
             (id INTEGER PRIMARY KEY AUTOINCREMENT,
              status TEXT NOT NULL,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')

conn.commit()
conn.close()

print("Database created successfully!")
EOF

# Set proper permissions
chmod 664 garage.db

echo "Database setup complete!"