from supabase import create_client, Client

from workers import env


SUPABASE_URL = env.SUPABASE_URL
SUPABASE_KEY = env.SUPABASE_KEY

_supabase = None


def get_supabase():
    global _supabase

    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    return _supabase


