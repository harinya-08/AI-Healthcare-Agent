from fastapi import FastAPI, Depends, status, Cookie, Request, UploadFile, File, HTTPException, APIRouter, Depends, Form
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from datetime import datetime, timedelta
from jose import jwt, ExpiredSignatureError, JWTError
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import uvicorn
import os
import traceback
import uuid
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
router = APIRouter()
load_dotenv()
from rag_pipeline import MedicalRAGPipeline
DATABASE_URL = "mysql+mysqlconnector://root:Aadithya%40123@localhost/aadithya"
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
app = FastAPI(title="MediHealth")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("FASTAPI_SECRET_KEY"))
oauth = OAuth()
oauth.register(
    name="auth_demo",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",  
    client_kwargs={
        "scope": "openid profile email"
    },
)
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
templates = Jinja2Templates(directory="templates")
rag = MedicalRAGPipeline()
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password = Column(String(255))
    role = Column(String(50), default="patient")
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
def get_current_user(access_token: str = Cookie(None)):
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": payload.get("sub"), "email": payload.get("email")}
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
async def root(request: Request):
    return templates.TemplateResponse(request=request, name="login.html", context={})
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="information.html", context={})
@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    request.session.clear()
    frontend_url = os.getenv("FRONTEND_URL")
    request.session["login_redirect"] = frontend_url 
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={}
    )
@app.post("/login")
async def login_post(
        request: Request,
        email: str = Form(...),
        password: str = Form(...),
        db: Session = Depends(get_db)
    ):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error_msg": "User not found"}
        )
    if not pwd_context.verify(password, user.password):
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error_msg": "Incorrect password"}
        )
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    response = RedirectResponse(url="/dashboard", status_code=303)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax"
    )
    return response
@router.get("/login/google")
async def login_google(request: Request):
    request.session.clear()
    frontend_url = os.getenv("FRONTEND_URL")
    redirect_url = os.getenv("REDIRECT_URL")
    request.session["login_redirect"] = frontend_url 
    return await oauth.auth_demo.authorize_redirect(
        request,
        redirect_url,
        prompt="consent"
    )
@router.get("/auth")
async def auth(request: Request):
    try:
        token = await oauth.auth_demo.authorize_access_token(request)
    except Exception:
        print(traceback.format_exc())
        raise HTTPException(status_code=401, detail="Google authentication failed.")
    user = token.get("userinfo") or {}
    user_id = user.get("sub")
    user_email = user.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Could not extract user info.")
    expires_in = token.get("expires_in", 3600)
    access_token = create_access_token(
        data={"sub": user_id, "email": user_email},
        expires_delta=timedelta(seconds=expires_in)
    )
    response = RedirectResponse("http://127.0.0.1:8000/analysis")
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return response
@app.get("/signup", response_class=HTMLResponse)
async def signup(request: Request):
    return templates.TemplateResponse(request=request, name="signup.html", context={})
@app.post("/signup")
async def signup_post(
        request: Request,
        email: str = Form(...),
        password: str = Form(...),
        confirm_password: str = Form(...),
        db: Session = Depends(get_db)
    ):
    if password != confirm_password:
        return templates.TemplateResponse(
            "signup.html",
            {
                "request": request,
                "error_msg": "Passwords do not match"
            }
        )
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return templates.TemplateResponse(
            "signup.html",
            {
                "request": request,
                "error_msg": "User already exists"
            }
        )
    hashed_password = pwd_context.hash(password)
    new_user = User(
        email=email,
        password=hashed_password,
        role="patient"   
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "success_msg": "Account created successfully! Please login."
        }
    )
@app.get("/login/doctor")
async def doctor_login_page(request: Request):
    return templates.TemplateResponse(
        "doctor_login.html",
        {"request": request}
    )
@app.post("/login/doctor")
async def doctor_login_post(
        request: Request,
        email: str = Form(...),
        password: str = Form(...),
        db: Session = Depends(get_db)
    ):
    user = db.query(User).filter(
        User.email == email,
        User.role == "doctor"   
    ).first()
    if not user:
        return templates.TemplateResponse(
            "doctor_login.html",
            {"request": request, "error_msg": "Doctor not found"}
        )
    if not pwd_context.verify(password, user.password):
        return templates.TemplateResponse(
            "doctor_login.html",
            {"request": request, "error_msg": "Incorrect password"}
        )
    access_token = create_access_token(
        data={"sub": str(user.id), "role": "doctor"}
    )
    response = RedirectResponse(url="/doctor-dashboard", status_code=303)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax"
    )
    return response
@app.get("/signup/doctor")
async def doctor_signup_page(request: Request):
    return templates.TemplateResponse(
        "doctor_signup.html",
        {"request": request}
    )
@app.post("/signup/doctor")
async def doctor_signup_post(
        request: Request,
        email: str = Form(...),
        password: str = Form(...),
        db: Session = Depends(get_db)
    ):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return templates.TemplateResponse(
            "doctor_signup.html",
            {
                "request": request, 
                "error_msg": "Doctor already exists"
            }
        )
    hashed_password = pwd_context.hash(password)
    new_user = User(
        email=email,
        password=hashed_password,
        role="doctor"   
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return templates.TemplateResponse(
        "doctor_login.html",
        {
            "request": request, 
            "success_msg": "Doctor account created successfully"
        }
    )
@app.get("/doctor-dashboard")
async def doctor_dashboard(request: Request):
    return templates.TemplateResponse(
        "doctor-dashboard.html",
        {"request": request}
    )
@app.get("/analysis", response_class=HTMLResponse)
async def analysis(request: Request):
    return templates.TemplateResponse(request=request, name="analysis.html", context={})
@app.get("/mediagent", response_class=HTMLResponse)
async def mediagent(request: Request):
    return templates.TemplateResponse(request=request, name="mediagent.html", context={})
@app.get("/reports", response_class=HTMLResponse)
async def reports(request: Request):
    return templates.TemplateResponse(request=request, name="report.html", context={})
@app.get("/logout",response_class=HTMLResponse)
async def logout(request:Request):
    return templates.TemplateResponse(request=request,name="settings.html",context={})
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed_types = [
        "application/pdf",
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' is not supported.")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max allowed size is 20 MB.")
    try:
        result = await rag.process_file(contents, file.filename, file.content_type)
        return {"success": True, "message": f"'{file.filename}' processed.", "chunks": result["chunks"], "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []
    system: Optional[str] = None
@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        response = await rag.answer(request.message, request.history, system=request.system)
        return {"success": True, "response": response}
    except TypeError:
        response = await rag.answer(request.message, request.history)
        return {"success": True, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get response: {str(e)}")
class HealthDataRequest(BaseModel):
    name: str
    bpm: Optional[float] = None
    vitalsGrade:  Optional[str] = "A"
    medGrade:     Optional[str] = "B+"
    mentalGrade:  Optional[str] = "A"
    avgMonthlyLabel: Optional[str] = None
    consultData:  Optional[List[float]] = None
    checkupData:  Optional[List[float]] = None
    chartHighlight: Optional[int] = 4
    appointments: Optional[List[Dict[str, Any]]] = []
    visits:       Optional[List[Dict[str, Any]]] = []
    rawNotes:     Optional[str] = ""
    class Config:
        extra = "allow"
def grade_meta(grade: str) -> dict:
    g = (grade or "A").upper()
    if g.startswith("A"): 
        return {
            "pill": "good", 
            "note": "Excellent"
        }
    if g.startswith("B"): 
        return {
            "pill": "ok",   
            "note": "Good"
        }
    return {
        "pill": "warn",  
        "note": "Needs Attention"
    }
@app.post("/api/health-data")
async def save_health_data(data: HealthDataRequest):
    bpm = data.bpm
    bpm_status = "Normal"
    if bpm is not None:
        if bpm < 60:    
            bpm_status = "Low"
        elif bpm > 100: 
            bpm_status = "High"
    avg_label = data.avgMonthlyLabel
    if not avg_label and data.consultData:
        avg_label = f"{sum(data.consultData)/len(data.consultData):.0f} visits/mo"
    vm = grade_meta(data.vitalsGrade or "A")
    mm = grade_meta(data.medGrade    or "B+")
    nm = grade_meta(data.mentalGrade or "A")
    return JSONResponse(content={
        "success": True, "name": data.name, "bpm": bpm, "bpmStatus": bpm_status,
        "vitalsGrade": data.vitalsGrade,  "vitalsPill": vm["pill"], "vitalsNote": vm["note"],
        "medGrade":    data.medGrade,     "medPill":    mm["pill"], "medNote":    mm["note"],
        "mentalGrade": data.mentalGrade,  "mentalPill": nm["pill"], "mentalNote": nm["note"],
        "avgMonthlyLabel": avg_label or "—",
        "consultData": data.consultData or [], "checkupData": data.checkupData or [],
        "chartHighlight": data.chartHighlight,
        "appointments": data.appointments or [], "visits": data.visits or [],
        "rawNotes": data.rawNotes,
    })
@app.post("/api/download-report")
async def download_report(data: HealthDataRequest):
    raise HTTPException(status_code=501, detail="PDF generation not configured. Frontend will generate the report.")
app.include_router(router)
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)