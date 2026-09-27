from db import get_supabase



def add_user(user_id : str, username : str):
    supabase = get_supabase()
    try:
        response = (
            supabase.table('users_goauth')
            .insert(
                {'user_id' : user_id, 'username' : username}
            )
            .execute()
        )
    except Exception as e:
        print(e)
        return False
    return len(response.data) != 0


def contains_user(user_id : str):
    supabase = get_supabase()
    response = (
        supabase.table('users_goauth')
        .select('user_id')
        .eq('user_id', user_id)
        .execute()
    )
    if len(response.data) > 1: 
        raise Exception('DUPLICATE USERs!')
    return len(response.data) == 1