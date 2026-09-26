import fastapi
from fastapi.responses import Response
from pydantic import BaseModel
from routers.auth import router as auth_router
from fastapi import APIRouter as base_router
from fastapi.middleware.cors import CORSMiddleware
from routers import features



app = fastapi.FastAPI()

#fix once we know what origins we want
origins = [
    "*",
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

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=6767)
