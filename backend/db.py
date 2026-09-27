from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
import os

SUPABASE_URL = env.SUPABASE_URL
SUPABASE_KEY = env.SUPABASE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
