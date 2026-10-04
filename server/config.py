import os
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
class Settings(BaseSettings):
    DATABASE_URI: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REDIS_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY:str
    
    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="ignore")

settings = Settings() # type: ignore