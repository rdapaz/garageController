#! /usr/bin/env python3
import paho.mqtt.client as mqtt
import time
import os
import sys
import json

current_dir = os.path.dirname(sys.argv[0])

data = {}

MQTT_SERVER = '10.11.12.118'

def on_connect(client, userdata, flags, rc):
    print("Connected With Result Code {}".format(rc))
    client.subscribe('garage/command')

def on_message(client, userdata, message):
    print(str(message.payload))
    # if message.topic == 'garage/command':
    #     if message.payload.decode() in ('open', 'close'):
    #         data['command'] = 'open'
    #         with open(os.path.join(current_dir, 'garageCommand.json'), 'w') as fout:
    #             json.dump(data, fout, indent=True)


client = mqtt.Client(protocol=mqtt.MQTTv31)
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_SERVER, 1883, 60)
client.loop_start()

while True:
    time.sleep(2)

client.loop_stop()
client.disconnect()