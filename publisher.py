#! /usr/bin/env python3
import RPi.GPIO as GPIO
from flask import Flask
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

    def scanGarageStatus(self):
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

    def toggleGarage(self):
        print('Garage would have opened')
        # GPIO.output(RELAY_OUT, True)
        # time.sleep(DELAY)
        # GPIO.output(RELAY_OUT, GPIO.LOW)


app = Flask(__name__)
g = GarageDoorController()

@app.route('/')
def index():
    return '<h1>Garage is {}</h1>'.format(g.garageStatus)

@app.route('/garage/<action>')
def action(action):
    if action == 'toggle':
        g.toggleGarage()
        time.sleep(5)
        return '<h1>Garage is {}</h1>'.format(g.garageStatus)


if __name__ == '__main__':
    
    try:   
        app.run(host='0.0.0.0', debug=True)
    except KeyboardInterrupt:
        GPIO.cleanup()
