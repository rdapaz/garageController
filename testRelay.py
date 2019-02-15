import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
output_pin = 24
DELAY = 1


GPIO.setup(output_pin, GPIO.OUT)
GPIO.output(output_pin, True)
time.sleep(DELAY)
GPIO.output(output_pin, GPIO.LOW)
GPIO.cleanup()


# Testing