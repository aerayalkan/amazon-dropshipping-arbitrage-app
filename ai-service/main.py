from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from routes.prediction import router as prediction_router
from routes.sentiment import router as sentiment_router
from routes.trends import router as trends_router
from routes.chatbot import router as chatbot_router
from routes.health import router as health_router

# Security
security = HTTPBearer()

# Initialize FastAPI app
app = FastAPI(
    title="Amazon Dropshipping AI Service",
    description="AI microservice for Amazon dropshipping platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production'da specific origins kullanın
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
async def root():
    return {
        "message": "Amazon Dropshipping AI Service",
        "version": "1.0.0",
        "status": "active"
    }

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Bu kısım backend ile entegre edilecek
    # Şimdilik basit bir kontrol yapıyoruz
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    return {"user_id": "test_user"}

# Include routers
app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(
    prediction_router, 
    prefix="/prediction", 
    tags=["prediction"],
    dependencies=[Depends(get_current_user)]
)
app.include_router(
    sentiment_router, 
    prefix="/sentiment", 
    tags=["sentiment"],
    dependencies=[Depends(get_current_user)]
)
app.include_router(
    trends_router, 
    prefix="/trends", 
    tags=["trends"],
    dependencies=[Depends(get_current_user)]
)
app.include_router(
    chatbot_router, 
    prefix="/chatbot", 
    tags=["chatbot"],
    dependencies=[Depends(get_current_user)]
)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )