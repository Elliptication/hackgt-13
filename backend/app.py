import fastapi
from fastapi.responses import Response
from pydantic import BaseModel
from routers.auth import router as auth_router
from fastapi import APIRouter as base_router
from fastapi.middleware.cors import CORSMiddleware
from routers import features, contributions, vote

app = fastapi.FastAPI()

origins = [
    "https://accessway.tech",
    "https://www.accessway.tech",
    "http://localhost:3000",
    "https://api.accessway.tech"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#app.include_router(base_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return "hello world!"
# app.include(auth.router)
app.include_router(features.router)
app.include_router(contributions.router)
app.include_router(vote.router)