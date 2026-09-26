from pathlib import Path

from app.tts import synthesize_risk

output = synthesize_risk(
    "There is one hidden concentration worth noting. Several holdings share exposure to semiconductor supply chains.",
    Path("static/audio/test_risk.mp3"),
)

print(f"Success: {output}")