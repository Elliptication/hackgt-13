import math
from db import get_supabase
from supabase import Client
import httpx
from workers import env
import json


def geo_radius_to_box(lat : float, long : float, radius : float):
    lat_range = radius / 69
    long_range = radius / (69.17 * math.cos(lat))
    min_lat = lat - lat_range
    max_lat = lat + lat_range
    min_long = long - long_range
    max_long = long + long_range

    return (min_lat, min_long), (max_lat, max_long)


OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_API_KEY = env.OPENAI_API_KEY

def process_image(image_path):
    supabase: Client = get_supabase()

    signed = (
        supabase.storage
        .from_('contribution_images')
        .create_signed_url(image_path, 120)
    )
    image_url = signed['signedUrl']

    payload = {
        "model": "gpt-6-luna",
        "messages": [
            {
                "role": "developer",
                "content": [{
                    "type": "text",
                    "text": "You are an image analyst focusing on accessibility. Your role is to classify an image as either a ramp, elevator, accessible bathroom, or accessible door. It can only be one, or it may be none of them. Use the json schema output. "
                }]
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Classify the following image."},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "accessibility_classification",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "classification": {
                            "type": "string",
                            "description": "Type of accessibility feature classified. Must be one of: ramp, elevator, bathroom, accessible doors, or none.",
                            "enum": ["ramp", "elevator", "accessible_bathroom", "accessible_doors", "none"],
                        }
                    },
                    "required": ["classification"],
                    "additionalProperties": False,
                },
            },
        },
        "verbosity": "low",
        "reasoning_effort": "medium",
        "store": False,
    }

    resp = httpx.post(
        OPENAI_URL,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content)["classification"]
