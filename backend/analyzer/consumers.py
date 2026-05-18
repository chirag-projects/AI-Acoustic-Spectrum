import time
import json
import asyncio


from .gemini_service import (
    interpret_audio_features
)
from .tasks import (
    process_audio_features
)

from channels.generic.websocket import (
    AsyncWebsocketConsumer
)

class AudioConsumer(
    AsyncWebsocketConsumer
):
    last_analysis_time = 0
    async def connect(self):

        await self.accept()

        print("WebSocket Connected")

    async def disconnect(
        self,
        close_code
    ):

        print("WebSocket Disconnected")

    async def receive(
        self,
        text_data
    ):

        data = json.loads(
            text_data
        )

        current_time = time.time()

    # Gemini every 5 sec only
        if ( current_time - self.last_analysis_time > 5):

            self.last_analysis_time = (current_time)

            print("\nSending To Gemini...")

            analysis = (
                interpret_audio_features(
                data
            )
        )

            print(analysis)

            await self.send(
                text_data=json.dumps({

                    "type":
                        "analysis",

                    "analysis":
                        analysis
            })
        )

        data = json.loads(text_data)

        print("Received Features:")
        process_audio_features.delay(data)