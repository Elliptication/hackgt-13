import fastapi
from fastapi import APIRouter
from public_db import supabase

router = APIRouter(prefix='/features', tags=['features'])

@router.get('/verified')
async def list_verified():
    response = (
        supabase.table("Features")
        .select('id', 'verified', 'latitude', 'longitude')
        # .eq('verified', True)
        .execute()
    )

    return response.data

