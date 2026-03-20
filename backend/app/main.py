from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import check_db_connection, init_db
from app.api import admin, auth, interactions, ripples, skills, sse, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if settings.DB_AUTO_INIT_ON_STARTUP:
        await init_db()
    else:
        await check_db_connection()
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(skills.router)
app.include_router(interactions.router)
app.include_router(ripples.router)
app.include_router(sse.router)
app.include_router(admin.router)


# Static files (CLI downloads, etc.)
_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
