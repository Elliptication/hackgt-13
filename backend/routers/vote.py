from fastapi import APIRouter, HTTPException, status
from db import supabase
from features import update_verification_status

router = APIRouter(prefix='/vote', tags=['features'])

@router.post('/')
async def vote(contribution_id : str, user_id : str, upvote : bool):
    response = (
        supabase.table('votes')
        .select('contribution_id', 'user_id', 'upvote')
        .eq('user_id', user_id)
        .eq('contribution_id', contribution_id)
        .execute()
    )

    sign = 1 if upvote else -1
    if len(response.data) == 0:
        # new vote: adds one vote and moves net by +/-1
        net_delta, total_delta = sign, 1
        confirm_response = (
            supabase.table('votes')
            .insert({
                'contribution_id': contribution_id,
                'user_id': user_id,
                'upvote': upvote,
            })
            .execute()
        )
    else:
        # changed vote flips net by +/-2; unchanged vote does nothing
        net_delta = 2 * sign if response.data[0]['upvote'] != upvote else 0
        total_delta = 0
        confirm_response = (
            supabase.table('votes')
            .update({'upvote': upvote})
            .eq('user_id', user_id)
            .eq('contribution_id', contribution_id)
            .execute()
        )

    feature_response = (
        supabase.table('Features')
        .select('contribution_id', 'net_votes', 'total_votes')
        .eq('contribution_id', contribution_id)
        .execute()
    )

    if len(feature_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='No feature for this contribution'
        )

    netvotes = feature_response.data[0]['net_votes'] or 0
    totalvotes = feature_response.data[0]['total_votes'] or 0

    if net_delta or total_delta:
        (
            supabase.table('Features')
            .update({
                'net_votes': netvotes + net_delta,
                'total_votes': totalvotes + total_delta,
            })
            .eq('contribution_id', contribution_id)
            .execute()
        )

    update_verification_status(contribution_id)

    return confirm_response

