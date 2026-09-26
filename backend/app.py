import fastapi
from fastapi.responses import Response
from pydantic import BaseModel
from auth import router as auth_router
from routes.route import router as score_router



app = fastapi.FastAPI()

