import RPi.GPIO as GPIO
import paho.mqtt.client as mqtt
import time
import logging
import datetime

# This is a test

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


if __name__ == '__main__':
    
    MQTT_SERVER = '10.11.12.118'
    
    lastStatus = False
    garageStatus = ''
    global toggleGarage
    toggleGarage = False

    g = GarageDoorController()
    

    def on_connect(client, userdata, flags, rc):
        print("Connected With Result Code {}".format(rc))
        client.subscribe('garage/command')
    
    def on_message(client, userdata, message):
        print(str(message.payload))
        if message.topic == 'garage/command':
            if message.payload.decode() in ('open', 'close'):
                toggleGarage = True
            else:
                toggleGarage = False
    
    client = mqtt.Client('garage_controller')
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_SERVER, 1883, 60)
    client.loop_start()
    time.sleep(1)
    

    while True:
        try:
            garageStatus = g.scanGarageStatus()
            if garageStatus != lastStatus:
                print(garageStatus)
                client.publish(topic='garage/status',
                               payload=garageStatus,
                               qos=0,
                               retain=False)
                lastStatus = garageStatus

            if toggleGarage:
                g.toggleGarage()
            time.sleep(5)
        except KeyboardInterrupt:
            GPIO.cleanup()
            client.loop_stop()
            client.disconnect()
