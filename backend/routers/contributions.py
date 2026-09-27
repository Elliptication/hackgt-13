from fastapi import APIRouter, HTTPException, status, Depends

from db import get_supabase
import hashlib
from random import randbytes
from routers.auth import get_current_user
from workers import env
from datetime import datetime

from supabase import Client
from utils import process_image

# from openai_client import get_openai_client

router = APIRouter(prefix='/contributions', tags=['contributions'])

SECRET = env.UPLOAD_SECRET
SUPABASE_URL = env.SUPABASE_URL

FEATURES = ["ramp", "elevator", "accessible_bathroom", "accessible_doors"]




@router.get('/init')
async def init_upload(lat: float, lon: float, type: str, file_type: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    user_id = current_user["id"]
    name = hashlib.md5((str(lat) + str(lon) + str(type) + user_id + datetime.now().isoformat()).encode('utf-8')).hexdigest() + file_type
    secret = hashlib.md5((str(lat) + str(lon) + str(type) + user_id + datetime.now().date().isoformat() + SECRET).encode('utf-8')).hexdigest()
    response = (
        supabase.storage
        .from_('contribution_images')
        .create_signed_upload_url(name)
        )

    return {'secret' : secret, 'signed_url' : response['signed_url'], 'path' : response['path']}

@router.get('/by_feature/{feature_id}')
async def get_contribution_id(feature_id: int):
    supabase = get_supabase()
    response = (
        supabase.table('Features')
        .select('contribution_id')
        .eq('id', feature_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Feature not found'
        )

    return {'contribution_id': response.data[0]['contribution_id']}

@router.post('/')
async def add_contribution(lat: float, lon: float, type: str, path: str, name : str, secret: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    # check secret
    user_id = current_user["id"]
    secret_expected = hashlib.md5((str(lat) + str(lon) + str(type) + user_id + datetime.now().date().isoformat() + SECRET).encode('utf-8')).hexdigest()

    if secret != secret_expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Secret did not match data'
        )

    if type not in FEATURES:
        raise HTTPException(
            status_code=status.HTTP_406_NOT_ACCEPTABLE,
            detail=f'Type of "{type}" is not allowed.',
        )
    
    
    # Create feature
    feature_response = (
        supabase.table('Features')
        .insert(
            {
                'verified' : False, 
                'location': f'POINT({lat} {lon})',
                'type' : type,
                'name' : name,
            }
        )
        .execute()
    )

    feature_id = feature_response.data[0]['id']

    # create contribution
    contribution_response = (
        supabase.table('contributions')
        .insert(
            {
                'user_id' : user_id,
                'feature_id' : feature_id,
                'image_path' : path
            }
        ).execute()
    )

    contribution_id = contribution_response.data[0]['id']

    feature_confirmation = (
        supabase.table('Features')
        .update({'contribution_id' : contribution_id})
        .eq('id', feature_id)
        .execute()
    )

    return {'feature' : feature_confirmation, 'contribution' : contribution_response}


@router.get('/')
async def get_contributions():
    supabase = get_supabase()

    response = (
        supabase.table('contributions')
        .select('*')
        .execute()
    )

    return response.data


@router.get('/classify/{contribution_id}')
async def classify_contribution(contribution_id):
    supabase = get_supabase()

    contrib_response = (
        supabase.table('contributions')
        .select('id','image_path')
        .eq('id', contribution_id)
        .execute()
    )

    image_path = contrib_response.data[0]['image_path']

    f_type = process_image(image_path)

    return f_type



    
# def process_image(image_path):
#     client = get_openai_client()

#     supabase : Client = get_supabase()

#     response = (
#         supabase.storage
#         .from_('contribution_images')
#         .create_signed_url(
#             image_path,
#             120
#         )
#     )

#     image_url = response['signedUrl']
    
#     response = client.responses.create(
#         model="gpt-6-luna",
#         reasoning={"effort": "medium"},
#         input=[
#             {
#                 "role": "developer",
#                 "content": [
#                   {
#                     "type": "text",
#                     "text": "You are an image analyst focusing on accessibility. Your role is to classify an image as either a ramp, elevator, accessible bathroom, or accessible door. It can only be one, or it may be none of them. Use the json schema output. "
#                   }
#                 ]
#             },
#             {
#                 "role": "user",
#                 "content": [
#                     {"type": "input_text", "text": "Classify the following image."},
#                     {
#                         "type": "input_image",
#                         "image_url": image_url,
#                     },
#                 ],
#             }
#         ],
#         response_format={
#           "type": "json_schema",
#           "json_schema": {
#             "name": "accessibility_classification",
#             "strict": True,
#             "schema": {
#               "type": "object",
#               "properties": {
#                 "classification": {
#                   "type": "string",
#                   "description": "Type of accessibility feature classified. Must be one of: ramp, elevator, bathroom, accessible doors, or none.",
#                   "enum": [
#                     "ramp",
#                     "elevator",
#                     "accessible_bathroom",
#                     "accessible_doors",
#                     "none"
#                   ]
#                 }
#               },
#               "required": [
#                 "classification"
#               ],
#               "additionalProperties": False
#             }
#           }
#         },
#         verbosity="low",
#         reasoning_effort="medium",
#         store=False
#     )

#     classification = response.choices[0].message['classification']

#     return classification