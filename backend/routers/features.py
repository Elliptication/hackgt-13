import fastapi
from fastapi import APIRouter
from db import get_supabase
from utils import geo_radius_to_box


router = APIRouter(prefix='/features', tags=['features'])




@router.get('')
async def features_by_location(lat : float, long : float, radius : float):
    supabase = get_supabase()
    
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

    data = [
        {
            'id' : v['id'], 
            'type' : v['type'],
            'name' : v['type'],
            'description' : '',
            'lat' : v['lat'],
            'lng' : v['long'],
            'status' : str(v['verified']),
            'contribution_id' : v['contribution_id']
        } for v in response.data
    
    ]

    return data
    



def update_verification_status(contribution_id : str):
    supabase = get_supabase()

    response = (
        supabase.table('Features')
        .select('net_votes', 'total_votes', 'verified')
        .eq('contribution_id', contribution_id)
        .execute()
    )
    if len(response.data) == 0:
        return None

    feature = response.data[0]
    net_votes = feature['net_votes'] or 0
    total_votes = feature['total_votes'] or 0


    should_verify = net_votes / total_votes > 0.6 and total_votes > 5


    if should_verify != feature['verified']:
        (
            supabase.table('Features')
            .update({'verified': should_verify})
            .eq('contribution_id', contribution_id)
            .execute()
        )

    return should_verify
