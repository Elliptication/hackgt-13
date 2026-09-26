import fastapi
from fastapi import APIRouter

router = APIRouter(prefix='/auth', tags=['auth'])

# @router.get("/")
# async def list_users():
#     return [{"id": 1, "name": "Ada"}]