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
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_allowed_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            try:
                return json.loads(self.ALLOWED_ORIGINS)
            except:
                return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
        return self.ALLOWED_ORIGINS

settings = Settings()
