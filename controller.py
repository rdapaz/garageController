#! /usr/bin/env python3
import RPi.GPIO as GPIO
from flask import Flask, render_template
import time

class GarageDoorController:

    def __init__(self):

        GPIO.setmode(GPIO.BCM)
        # Private properties
        self.TRIGGER = 16
        self.ECHO = 26
        self.RELAY_OUT = 24
        self.DELAY = 0.25
        self.ERROR = 0.05

        # Public properties
        self.distance = 0.0
        self.status = None
        self.lastStatus = None

        GPIO.setwarnings(False)
        GPIO.setup(self.TRIGGER, GPIO.OUT)
        GPIO.setup(self.ECHO, GPIO.IN)
        GPIO.setup(self.RELAY_OUT, GPIO.OUT)

    def getGarageStatus(self):
        """
            Checks whether the garage is open or closed
        """
        GPIO.output(self.TRIGGER, False)
        time.sleep(0.5)
        GPIO.output(self.TRIGGER, True)
        time.sleep(0.00001)
        GPIO.output(self.TRIGGER, False)
        while GPIO.input(self.ECHO) == 0:
            pulse_start = time.time()
        while GPIO.input(self.ECHO) == 1:
            pulse_end = time.time()
        self.distance = 17150.0 * (pulse_end - pulse_start)

        if self.distance > 10:
            self.status = "Closed"
        else:
            self.status = "Open"

        return self.status

    def toggleGarage(self, action):
        # GPIO.output(self.RELAY_OUT, True)
        # time.sleep(self.DELAY)
        # GPIO.output(self.RELAY_OUT, GPIO.LOW)
        return True
        


app = Flask(__name__)
global g
g = GarageDoorController()


@app.route('/')
def index():
    templateData = {
        'garageStatus' : g.getGarageStatus()
    }
    return render_template('main.html', **templateData)

@app.route('/garage/<action>')
def action(action):
    if action in ('open', 'close'):
        g.toggleGarage(action)
        time.sleep(5)
        return index()

if __name__ == '__main__':
    
    try:   
        app.run(host='0.0.0.0', port=80, debug=True)
    except KeyboardInterrupt:
        GPIO.cleanup()
