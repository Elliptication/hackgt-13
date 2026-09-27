from supabase import create_client, Client

from workers import env


SUPABASE_URL = env.SUPABASE_URL
SUPABASE_KEY = env.SUPABASE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)