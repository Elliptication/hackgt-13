from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
import os
print(os.environ.get('SUPABASE_KEY'))

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)