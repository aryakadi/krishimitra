import json
from typing import List, Union
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    SNOWFLAKE_ACCOUNT: str = ""
    SNOWFLAKE_USER: str = ""
    SNOWFLAKE_PASSWORD: str = ""
    SNOWFLAKE_DATABASE: str = "AGRISMART_DB"
    SNOWFLAKE_SCHEMA: str = "AGRI_SCHEMA"
    SNOWFLAKE_WAREHOUSE: str = "AGRISMART_WH"
    SNOWFLAKE_ROLE: str = "SYSADMIN"
    ALLOWED_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "https://krishimitra-nine-wine.vercel.app"
    ]
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_allowed_origins(self) -> List[str]:
        origins = []
        if isinstance(self.ALLOWED_ORIGINS, str):
            try:
                origins = json.loads(self.ALLOWED_ORIGINS)
                if not isinstance(origins, list):
                    origins = [str(origins)]
            except:
                origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
        elif isinstance(self.ALLOWED_ORIGINS, list):
            origins = self.ALLOWED_ORIGINS.copy()
            
        # Forcefully inject the production Vercel frontend URL to bypass any deployment environment variable parsing bugs
        vercel_url = "https://krishimitra-nine-wine.vercel.app"
        if vercel_url not in origins:
            origins.append(vercel_url)
            
        return origins

settings = Settings()
