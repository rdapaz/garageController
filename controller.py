import RPi.GPIO as GPIO
import paho.mqtt.client as mqtt
import time
import logging
import datetime


class GarageDoorController:

    def __init__(self):

        def on_message(client, userdata, message):
            print('Got a message...')
            if message.topic == 'garage/command':
                if message.payload.decode() in ('open', 'close'):
                    self.toggleGarage()

        def on_connect(client, userdata, flags, rc):
            print("Connected With Result Code {}".format(rc))
            self.client1.subscribe('garage/command')

        GPIO.setmode(GPIO.BCM)
        # Private properties
        self.TRIGGER = 16
        self.ECHO = 26
        self.RELAY_OUT = 24
        self.DELAY = 0.25
        self.ERROR = 0.05
        self.MQTT_SERVER = '10.11.12.118'

        # Public properties
        self.distance = 0.0
        self.status = None
        self.lastStatus = None
        self.client1 = mqtt.Client('garage_controller_1')
        self.client2 = mqtt.Client('garage_controller_2')
        self.client1.on_connect = on_connect
        self.client1.on_message = on_message
        self.client1.connect(self.MQTT_SERVER, port=1883)

        GPIO.setup(self.TRIGGER, GPIO.OUT)
        GPIO.setup(self.ECHO, GPIO.IN)
        GPIO.setup(self.RELAY_OUT, GPIO.OUT)

    def checkIfOpen(self):
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

        if self.status != self.lastStatus:
            self.statusChange = True
        else:
            self.statusChange = False

        self.lastStatus = self.status

    def publishStatus(self):
        """
            Publish status via MQTT
        """

        if self.statusChange:
            print(self.status)
            self.client2.connect(self.MQTT_SERVER, port=1883)
            self.client2.publish(topic='garage/status',
                                 payload=self.status,
                                 qos=0,
                                 retain=False)
            self.client2.disconnect()

    def toggleGarage(self):
        print('Garage would have opened')
        # GPIO.output(RELAY_OUT, True)
        # time.sleep(DELAY)
        # GPIO.output(RELAY_OUT, GPIO.LOW)

    def run(self):

        while True:
            try:
                self.checkIfOpen()
                self.publishStatus()
                time.sleep(2)
                self.client1.loop()
            except KeyboardInterrupt:
                GPIO.cleanup()
                self.client1.loop_stop()


if __name__ == '__main__':
    g = GarageDoorController()
    g.run()
