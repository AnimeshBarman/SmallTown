import os
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
class Settings(BaseSettings):
    DATABASE_URI: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REDIS_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    GROQ_API_KEY: str
    GOOGLE_CLIENT_ID: str | None = None
    TURNSTILE_SECRET_KEY: str | None = None
    
    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="ignore")

settings = Settings() # type: ignore