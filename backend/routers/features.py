import fastapi
from fastapi import APIRouter
from db import supabase
from utils import geo_radius_to_box

router = APIRouter(prefix='/features', tags=['features'])

@router.get('/verified')
async def list_verified(latitude: float, longitude: float, radius: float):
    response = (
        supabase.table("Features")
        .select('id', 'verified', 'latitude', 'longitude')
        .eq('verified', True)
        .order('latitude', )
        .execute()
    )

    return response.data


@router.get('/bylocation')
async def features_by_location(lat : float, long : float, radius : float):
    points = geo_radius_to_box(lat, long, radius)
    response = (
        supabase.rpc(
            'nearby_features',
            {
                'min_lat' : points[0][0],
                'min_long' : points[0][1],
                'max_lat' : points[1][0],
                'max_long' : points[1][1]
            }
        ).execute()
    )

    return response.data
    



