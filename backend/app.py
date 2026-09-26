import fastapi
from fastapi.responses import Response
from pydantic import BaseModel
#from auth import router as auth_router
from routes.route import router as base_router
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, features



app = fastapi.FastAPI()

#fix once we know what origins we want
origins = [
    "*",
]

app.add_middleware(
    allow_origins=origins, 
    allow_credentials=true,
    allow_methods=["*"],
    allow_headers=["*"],
)


# app.include_router(base_router)

app.include(auth.router)
app.include(features.router)
