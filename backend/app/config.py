from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rfq_auction"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/rfq_auction"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 480

    class Config:
        env_file = ".env"


settings = Settings()
