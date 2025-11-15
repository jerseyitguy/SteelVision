# SPDX-FileCopyrightText: Copyright (C) 2025 ARDUINO SA <http://www.arduino.cc>
#
# SPDX-License-Identifier: MPL-2.0

from arduino.app_utils import App
from arduino.app_bricks.web_ui import WebUI
from arduino.app_bricks.video_objectdetection import VideoObjectDetection
from datetime import datetime, UTC

ui = WebUI()
detection_stream = VideoObjectDetection(confidence=0.5, debounce_sec=0.0)

ui.on_message("override_th", lambda sid, threshold: detection_stream.override_threshold(threshold))

# Example usage: Register a callback for when a specific object is detected

def face_detected():
  pass  # Implement your logic here, e.g., send a notification

detection_stream.on_detect("face", face_detected)

# === THIS FUNCTION IS NOW CORRECT ===
def send_detections_to_ui(detections: dict):
  # detections is {'face': {'confidence': ..., 'bounding_box_xyxy': (...)}}
  for key, value in detections.items():
    
    # Get the coordinates tuple (e.g., (233, 249, 360, 397))
    box_xyxy = value.get("bounding_box_xyxy")
    
    # Convert (x1, y1, x2, y2) to {x, y, width, height}
    box_data = None
    if box_xyxy and len(box_xyxy) == 4:
      x1, y1, x2, y2 = box_xyxy
      box_data = {
        "x": x1,
        "y": y1,
        "width": x2 - x1,
        "height": y2 - y1
      }

    # Build the message for the frontend
    entry = {
      "content": key,
      "confidence": value.get("confidence"),
      "box": box_data,  # Send the new {x, y, w, h} object (or None)
      "timestamp": datetime.now(UTC).isoformat()
    }    
    
    ui.send_message("detection", message=entry)

detection_stream.on_detect_all(send_detections_to_ui)

App.run()