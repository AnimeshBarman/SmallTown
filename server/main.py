from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import uvicorn
from config import settings
from database import get_db

from api.properties import router as properties_router
from api.auth import router as auth_router
from api.search import router as search_router
from api.moderation import router as moderation_router
from api.feedback import router as feedback_router


app = FastAPI(title="Welcome to SmallTown Api", version="1.0.0")

origins = [settings.FRONTEND_ORIGIN.rstrip("/")]
if not settings.COOKIE_SECURE:
    origins.extend([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.8:3000",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_same_origin_for_mutations(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if not origin or origin.rstrip("/") not in origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Request origin is not allowed."},
            )
    return await call_next(request)


app.include_router(properties_router, prefix="/api/v1/properties", tags=["Properties"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(search_router, prefix="/api/v1/search", tags=["AI Search"])
app.include_router(moderation_router, prefix="/api/v1", tags=["Moderation"])
app.include_router(feedback_router, prefix="/api/v1/feedback", tags=["Feedback"])




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