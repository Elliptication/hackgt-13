from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
import httpx
import os
from workers import env
import jwt
import datetime
import secrets
import urllib.parse
from urllib.parse import urlparse


router = APIRouter(prefix='/auth', tags=['auth'])


# Google OAuth credentials
CLIENT_ID = env.GOOGLE_CLIENT_ID
CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET
JWT_SECRET = env.JWT_SECRET

returnUrl = "https://api.accessway.tech"

REDIRECT_URI = getattr(env, 'GOOGLE_REDIRECT_URI', returnUrl + '/auth/callback')
FRONTEND_URL = "https://www.accessway.tech" 

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'





@router.get("/")
def home():
    return {"message": "Welcome to the Google OAuth App"}

# This route redirects the user to the Google OAuth login page
@router.get("/login")
def login():
    state = secrets.token_urlsafe(32)
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
    }
    auth_url = f"{AUTH_URL}?{urllib.parse.urlencode(params)}"
    response = RedirectResponse(auth_url)
    response.set_cookie(key='oauth_state', value=state, httponly=True, secure=True, samesite='lax', domain=urlparse(FRONTEND_URL).netloc)
    return response



@router.get("/callback")
async def callback(request: Request):
    expected_state = request.cookies.get('oauth_state')
    actual_state = request.query_params.get('state')
    if not expected_state or expected_state != actual_state:
        raise HTTPException(status_code=400, detail="State mismatch")

    # Get the code from the query parameters
    code = request.query_params.get('code')
    if not code:
        raise HTTPException(status_code=400, detail="Error: No code provided")

    # Get the access token from Google
    token_data = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': REDIRECT_URI,
    }


    async with httpx.AsyncClient() as client:
        token_response = await client.post(TOKEN_URL, data=token_data)
        token_response.raise_for_status()
        token_json = token_response.json()
        access_token = token_json.get('access_token')

        if not access_token:
            raise HTTPException(status_code=400, detail="Error: No access token received")

        user_info_response = await client.get(USERINFO_URL, headers={'Authorization': f'Bearer {access_token}'})
        user_info = user_info_response.json()
    
    user_id = user_info.get('sub')
    email = user_info.get('email')
    name = user_info.get('name')

    # Generate JWT
    payload = {
        'sub': user_id,
        'email': email,
        'name': name,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

    # Set JWT in cookie
    response = RedirectResponse(url=FRONTEND_URL)
    response.set_cookie(key='jwt', value=token, httponly=True, secure=True, samesite='lax', domain=urlparse(FRONTEND_URL).netloc)
    response.set_cookie(key='user_id', value=str(user_id), httponly=True, secure=True, samesite='lax', domain=urlparse(FRONTEND_URL).netloc)
    response.set_cookie(key='username', value=str(name), httponly=True, secure=True, samesite='lax', domain=urlparse(FRONTEND_URL).netloc)
    return response


@router.get("/profile")
def get_profile(request: Request):
    user_id = request.cookies.get("user_id")
    username = request.cookies.get("username")
    verify_token(request)
    return user_id, username


@router.get("/me")
def get_current_user(request: Request):
    payload = decode_token(request)
    return {
        "id": payload.get("sub"),
        "name": payload.get("name"),
        "email": payload.get("email"),
    }


@router.post("/logout")
def logout():
    response = JSONResponse({"message": "Logged out"})
    cookie_domain = urlparse(FRONTEND_URL).netloc
    for cookie_name in ("jwt", "user_id", "username"):
        response.delete_cookie(key=cookie_name, domain=cookie_domain, path="/")
    return response


def decode_token(request: Request):
    token = request.cookies.get('jwt')
    if not token:
        raise HTTPException(status_code=401, detail="No token found")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# A utility for debugging, specifically to check the contents and validility of the JWT
@router.get("/verify-token")
def verify_token(request: Request):
    return JSONResponse(content=decode_token(request))