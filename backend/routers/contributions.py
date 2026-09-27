from fastapi import APIRouter, HTTPException, status

from db import supabase
import hashlib
from random import randbytes

from dotenv import load_dotenv
load_dotenv()
import os
from datetime import datetime

router = APIRouter(prefix='/contributions', tags=['features'])

SECRET = os.getenv('UPLOAD_SECRET')

# needs auth!!
@router.get('/init')
async def init_upload(lat : float, lon : float, type : str, file_type : str):
    user_id = 'heyyo' # NEEDS AUTH!!
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

# needs auth!!
@router.post('/')
async def add_contribution(lat: float, lon: float, type : str, path: str, secret : str):
    # check secret
    user_id = 'heyyo' # needs auth!!!
    secret_expected = hashlib.md5((str(lat) + str(lon) + str(type) + user_id + datetime.now().date().isoformat() + SECRET).encode('utf-8')).hexdigest()

    if secret != secret_expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Secret did not match data'
        )
    
    # Create feature
    feature_response = (
        supabase.table('Features')
        .insert(
            {
                'verified' : False, 
                'location': f'POINT({lat} {lon})',
                'type' : type,


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
    
    
