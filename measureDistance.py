import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

TRIGGER = 16
ECHO = 26
RELAY_OUT = 24
DELAY=0.25
ERROR = 0.05


GPIO.setup(TRIGGER, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)
GPIO.setup(RELAY_OUT, GPIO.OUT)

def calculateDistance():
    GPIO.output(TRIGGER, False)
    time.sleep(0.5)
    GPIO.output(TRIGGER, True)
    time.sleep(0.00001)
    GPIO.output(TRIGGER, False)
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()
    distance = 17150.0 *(pulse_end - pulse_start)
    return distance

try:
    while True:
        distance = calculateDistance()
        if distance > 2600:
            print("Out of range")
            GPIO.output(RELAY_OUT, False)
        else:
            print("Distance = {:.5} cm".format(distance))
        time.sleep(2)
finally:
    print("Cleaning up")
    GPIO.cleanup()
