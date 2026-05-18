from celery import shared_task
from .gemini_service import (
    interpret_audio_features
)

@shared_task
def process_audio_features(
    data
):
    

    # print("\n=== CELERY TASK ===")
    

    # print(data)
    analysis = interpret_audio_features(data)
    print("\n=== GEMINI ANALYSIS ===")

    print(analysis)


    peak = data.get(
            "peakFrequency"
        )

    centroid =data.get(
            "spectralCentroid"
        )

    rms = data.get("rms")

    print(
        f"Peak: {peak}"
    )

    print(
        f"Centroid: {centroid}"
    )

    print(
        f"RMS: {rms}"
    )

    return {
        "Analysis": analysis
    }
