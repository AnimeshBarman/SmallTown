from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import uvicorn
from database import get_db

from api.properties import router as properties_router
from api.auth import router as auth_router
from api.search import router as search_router

app = FastAPI(title="Welcome to SmallTown Api", version="1.0.0")

origins = [
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties_router, prefix="/api/v1/properties", tags=["Properties"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(search_router, prefix="/api/v1/search", tags=["AI Search"])


@app.get("/")
def root():
    return {"Message": "Welcome to SmallTown Api"}


@app.get("/api/v1/test-db")
def test_database_connection(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"message": "Supabase PostgreSQL Database Connected Successfully! 🎉"}
    except Exception as e:
        return {"status": "Database Connection Failed..!", "error": str(e)}
    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)