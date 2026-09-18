import os
import uuid

from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, func
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pypdf import PdfReader
from docx import Document
import bcrypt
import json
import re
from jose import JWTError, jwt

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

load_dotenv(
    dotenv_path=Path(__file__).with_name(".env")
)

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

# --------------------------------------------------------------------
# Step 44.12 — Real AI service configuration
#
# openai_client stays None if the "openai" package isn't installed or
# OPENAI_API_KEY isn't set, so every real-AI function below falls back
# to the existing rule-based logic instead of crashing the app.
# --------------------------------------------------------------------

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

openai_client = None

if OpenAI and OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as error:
        print(f"OpenAI client initialization error: {error}")
        openai_client = None


def parse_ai_json(text):
    """
    Best-effort parse of an AI response into a dict.

    Some AI responses are plain prose (fine, callers fall back to that),
    some are clean JSON, and some are JSON wrapped in extra prose/markdown
    fences. This tries all three before giving up, so a malformed or
    partial AI response never gets passed to the frontend as if it were
    valid structured data.
    """
    if not text:
        return None

    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if match:
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None

    return None


# --------------------------------------------------------------------
# Step 44.42 — Simple in-memory AI response cache.
#
# This is a temporary, per-process optimization to avoid calling the
# paid AI API every time the same data is requested again with no
# underlying change. It resets whenever the server restarts/redeploys;
# a production setup should replace this with PostgreSQL or Redis.
# --------------------------------------------------------------------

AI_CACHE = {}


def get_ai_cache(key):
    return AI_CACHE.get(key)


def set_ai_cache(key, value):
    AI_CACHE[key] = value

# --------------------------------------------------------------------
# Step 17 — Password hashing + JWT authentication config
# --------------------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not configured")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


def create_access_token(student_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(student_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        student_id = payload.get("sub")

        if student_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        return int(student_id)

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    degree = Column(String)
    branch = Column(String)
    cgpa = Column(Float)
    target_role = Column(String)


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    filename = Column(String)
    target_role = Column(String)

    detected_skills = Column(Text)

    resume_score = Column(Integer)
    skills_score = Column(Integer)
    education_score = Column(Integer)
    projects_score = Column(Integer)
    experience_score = Column(Integer)
    certifications_score = Column(Integer)
    completeness_score = Column(Integer)


class CodingProgress(Base):
    __tablename__ = "coding_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    problems_solved = Column(Integer, default=0)
    total_problems = Column(Integer, default=100)
    coding_score = Column(Integer, default=0)


class CodingAttempt(Base):
    __tablename__ = "coding_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    question_id = Column(Integer)
    is_correct = Column(Integer, default=0)


class CodingQuestion(Base):
    __tablename__ = "coding_questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    option_a = Column(String)
    option_b = Column(String)
    option_c = Column(String)
    option_d = Column(String)
    answer = Column(String)
    category = Column(String, default="Programming")
    difficulty = Column(String, default="Easy")


class AptitudeQuestion(Base):
    __tablename__ = "aptitude_questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    option_a = Column(String)
    option_b = Column(String)
    option_c = Column(String)
    option_d = Column(String)
    answer = Column(String)
    category = Column(String, default="General")
    difficulty = Column(String, default="Easy")


class AptitudeAttempt(Base):
    __tablename__ = "aptitude_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    question_id = Column(Integer)
    is_correct = Column(Integer, default=0)


class AptitudeProgress(Base):
    __tablename__ = "aptitude_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    questions_attempted = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    aptitude_score = Column(Integer, default=0)


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    category = Column(String)
    difficulty = Column(String, default="Easy")


class InterviewAttempt(Base):
    __tablename__ = "interview_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    question_id = Column(Integer)
    answer = Column(String)
    score = Column(Integer, default=0)


class ProjectProgress(Base):
    __tablename__ = "project_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    projects_completed = Column(Integer, default=0)
    projects_target = Column(Integer, default=5)
    project_score = Column(Integer, default=0)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    name = Column(String)
    description = Column(String)
    technology = Column(String)
    status = Column(String, default="Not Started")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    role = Column(String)
    package = Column(String)
    eligibility = Column(String)
    skills = Column(String)


class CompanyPreparation(Base):
    __tablename__ = "company_preparation"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    company_id = Column(Integer)
    skill = Column(String)
    completed = Column(Integer, default=0)


class StudentCreate(BaseModel):
    name: str
    email: str
    degree: str
    branch: str
    cgpa: float
    target_role: str


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    technology: str = ""
    status: str = "Not Started"


class RegisterData(BaseModel):
    name: str
    email: str
    password: str
    degree: str
    branch: str
    cgpa: float
    target_role: str


class LoginData(BaseModel):
    email: str
    password: str


Base.metadata.create_all(bind=engine)

app = FastAPI()
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "PlacementPro AI Backend Running"}


@app.get("/database")
def database_test():
    return {"message": "PostgreSQL Connected Successfully"}


# --------------------------------------------------------------------
# Step 15 / 17 — Authentication (Register, Login, JWT)
# --------------------------------------------------------------------

@app.post("/register")
def register_student(data: RegisterData):
    db = SessionLocal()

    existing = db.query(Student).filter(
        Student.email == data.email
    ).first()

    if existing:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists"
        )

    student = Student(
        name=data.name,
        email=data.email,
        password=bcrypt.hashpw(
            data.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8"),
        degree=data.degree,
        branch=data.branch,
        cgpa=data.cgpa,
        target_role=data.target_role
    )

    db.add(student)
    db.commit()
    db.refresh(student)
    db.close()

    result = {
        "access_token": create_access_token(student.id),
        "token_type": "bearer",
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "degree": student.degree,
        "branch": student.branch,
        "cgpa": student.cgpa,
        "target_role": student.target_role
    }

    return result


@app.post("/login")
def login_student(data: LoginData):
    db = SessionLocal()

    student = db.query(Student).filter(
        Student.email == data.email
    ).first()

    if not student or not student.password:
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not bcrypt.checkpw(
        data.password.encode("utf-8"),
        student.password.encode("utf-8")
    ):
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    result = {
        "access_token": create_access_token(student.id),
        "token_type": "bearer",
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "degree": student.degree,
        "branch": student.branch,
        "cgpa": student.cgpa,
        "target_role": student.target_role
    }

    db.close()

    return result


@app.get("/auth/me")
def get_my_profile(
    student_id: int = Depends(get_current_student)
):
    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    result = {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "degree": student.degree,
        "branch": student.branch,
        "cgpa": student.cgpa,
        "target_role": student.target_role
    }

    db.close()

    return result


@app.post("/students")
def create_student(student: StudentCreate):
    db = SessionLocal()

    new_student = Student(
        name=student.name,
        email=student.email,
        degree=student.degree,
        branch=student.branch,
        cgpa=student.cgpa,
        target_role=student.target_role
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    db.close()

    return {
        "message": "Student created successfully",
        "student_id": new_student.id
    }


@app.put("/students/{student_id}")
def update_student(
    student_id: int,
    student: StudentCreate,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    existing_student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not existing_student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    existing_student.name = student.name
    existing_student.email = student.email
    existing_student.degree = student.degree
    existing_student.branch = student.branch
    existing_student.cgpa = student.cgpa
    existing_student.target_role = student.target_role

    db.commit()
    db.refresh(existing_student)
    db.close()

    return {
        "message": "Student updated successfully",
        "student_id": existing_student.id
    }


RESUME_DIR = Path("uploads/resumes")
RESUME_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_RESUME_EXTENSIONS = {".pdf", ".docx"}
MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB


async def validate_and_save_resume(file: UploadFile) -> Path:
    """
    Validates a resume upload by file extension and size, then saves it
    under a generated (non-user-controlled) filename.

    Returns the path the file was saved to.
    """
    file_extension = Path(file.filename or "").suffix.lower()

    if file_extension not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are allowed."
        )

    file_content = await file.read()

    if len(file_content) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must be less than 5 MB."
        )

    safe_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = RESUME_DIR / safe_filename

    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    return file_path


def extract_text(file_path):

    if file_path.suffix.lower() == ".pdf":
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    elif file_path.suffix.lower() == ".docx":
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    return ""


@app.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...)):

    file_path = await validate_and_save_resume(file)

    text = extract_text(file_path)

    return {
        "message": "Resume uploaded successfully",
        "filename": file_path.name,
        "text": text
    }


# NOTE: this is a placeholder keyword-matching analyzer, not a real AI model.
# It's here so the ResumePage in the frontend has something to call. Step 7.5
# (mentioned in the frontend walkthrough) is where this gets replaced with a
# real scoring model that also weighs education, projects, experience, etc.
ROLE_SKILLS = {
    "software developer": [
        "python", "java", "c++", "sql", "git",
        "javascript", "oops", "dsa", "react"
    ],

    "frontend developer": [
        "html", "css", "javascript", "react",
        "typescript", "git", "bootstrap"
    ],

    "backend developer": [
        "python", "java", "fastapi", "sql",
        "mongodb", "docker", "git", "rest api"
    ],

    "data analyst": [
        "python", "sql", "excel", "pandas",
        "numpy", "power bi", "tableau"
    ],

    "full stack developer": [
        "html", "css", "javascript", "react",
        "node.js", "sql", "mongodb", "git"
    ]
}

EDUCATION_KEYWORDS = [
    "b.tech", "btech", "b.e", "be",
    "bachelor", "degree", "computer science",
    "information technology", "engineering"
]

PROJECT_KEYWORDS = [
    "project", "projects", "developed", "built",
    "implemented", "application", "system"
]

EXPERIENCE_KEYWORDS = [
    "experience", "internship", "intern",
    "worked", "employment", "developer"
]

CERTIFICATION_KEYWORDS = [
    "certification", "certifications",
    "certificate", "certified", "nptel",
    "coursera", "udemy"
]

SECTION_KEYWORDS = [
    "education",
    "skills",
    "projects",
    "experience",
    "certifications",
    "achievements"
]


def keyword_score(text, keywords, max_score):
    """
    Gives a score based on how many relevant keywords
    are found in the resume.
    """

    found = 0

    for keyword in keywords:
        if keyword.lower() in text:
            found += 1

    if not keywords:
        return 0

    score = (found / len(keywords)) * max_score

    return round(score)


def extract_resume_profile(text: str):
    lowered = text.lower()

    profile = {
        "projects": [],
        "certifications": [],
        "experience": [],
        "education": [],
    }

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    current_section = None

    section_map = {
        "project": "projects",
        "projects": "projects",
        "certification": "certifications",
        "certifications": "certifications",
        "experience": "experience",
        "work experience": "experience",
        "education": "education",
    }

    for line in lines:
        normalized = line.lower().strip(":- ")

        matched_section = None

        for section_name, section_key in section_map.items():
            if normalized == section_name:
                matched_section = section_key
                break

        if matched_section:
            current_section = matched_section
            continue

        if current_section:
            profile[current_section].append(line)

    return profile


def detect_resume_skills(text: str, role_skills: list):
    lowered = text.lower()

    detected = []
    missing = []

    skill_variants = {
        "oop": [
            "oop",
            "oops",
            "object oriented programming",
            "object-oriented programming"
        ],

        "javascript": [
            "javascript",
            "java script",
            "js"
        ],

        "react": [
            "react",
            "reactjs",
            "react.js"
        ],

        "node.js": [
            "node.js",
            "nodejs",
            "node js"
        ],

        "postgresql": [
            "postgresql",
            "postgres",
            "postgres sql"
        ],

        "dsa": [
            "dsa",
            "data structures",
            "data structures and algorithms"
        ],

        "rest api": [
            "rest api",
            "restful api",
            "rest"
        ],

        "machine learning": [
            "machine learning",
            "machine-learning",
            "ml"
        ],
    }

    for skill in role_skills:
        canonical = normalize_skill(skill)

        variants = skill_variants.get(
            canonical,
            [canonical]
        )

        found = any(
            variant in lowered
            for variant in variants
        )

        if found:
            detected.append(skill)
        else:
            missing.append(skill)

    return detected, missing


def analyze_resume_text(text: str, target_role: str = "Software Developer"):

    lowered = text.lower()

    profile = extract_resume_profile(text)

    role_key = target_role.lower().strip()

    core_skills = ROLE_SKILLS.get(
        role_key,
        ROLE_SKILLS["software developer"]
    )

    words = text.split()

    # --------------------------------
    # 1. SKILLS - 25%
    # --------------------------------

    strengths, missing_skills = detect_resume_skills(text, core_skills)

    skills_score = round(
        (len(strengths) / len(core_skills)) * 25
    )

    # --------------------------------
    # 2. EDUCATION - 15%
    # --------------------------------

    education_found = [
        keyword
        for keyword in EDUCATION_KEYWORDS
        if keyword in lowered
    ]

    if len(education_found) >= 3:
        education_score = 15
    elif len(education_found) == 2:
        education_score = 12
    elif len(education_found) == 1:
        education_score = 8
    else:
        education_score = 0


    # --------------------------------
    # 3. PROJECTS - 20%
    # --------------------------------

    project_matches = [
        keyword
        for keyword in PROJECT_KEYWORDS
        if keyword in lowered
    ]

    if "projects" in lowered or "project" in lowered:
        if len(project_matches) >= 4:
            projects_score = 20
        elif len(project_matches) >= 2:
            projects_score = 15
        else:
            projects_score = 10
    else:
        projects_score = 0


    # --------------------------------
    # 4. EXPERIENCE - 15%
    # --------------------------------

    experience_matches = [
        keyword
        for keyword in EXPERIENCE_KEYWORDS
        if keyword in lowered
    ]

    if len(experience_matches) >= 4:
        experience_score = 15
    elif len(experience_matches) >= 2:
        experience_score = 10
    elif len(experience_matches) == 1:
        experience_score = 5
    else:
        experience_score = 0


    # --------------------------------
    # 5. CERTIFICATIONS - 10%
    # --------------------------------

    certification_matches = [
        keyword
        for keyword in CERTIFICATION_KEYWORDS
        if keyword in lowered
    ]

    if len(certification_matches) >= 3:
        certifications_score = 10
    elif len(certification_matches) >= 2:
        certifications_score = 7
    elif len(certification_matches) == 1:
        certifications_score = 5
    else:
        certifications_score = 0


    # --------------------------------
    # 6. RESUME COMPLETENESS - 15%
    # --------------------------------

    sections_found = [
        section
        for section in SECTION_KEYWORDS
        if section in lowered
    ]

    word_score = 0

    if len(words) >= 400:
        word_score = 5
    elif len(words) >= 250:
        word_score = 4
    elif len(words) >= 150:
        word_score = 3
    elif len(words) >= 80:
        word_score = 2
    else:
        word_score = 1

    section_score = round(
        (len(sections_found) / len(SECTION_KEYWORDS)) * 10
    )

    completeness_score = min(
        word_score + section_score,
        15
    )


    # --------------------------------
    # FINAL SCORE
    # --------------------------------

    resume_score = (
        skills_score +
        education_score +
        projects_score +
        experience_score +
        certifications_score +
        completeness_score
    )

    resume_score = min(resume_score, 100)


    # --------------------------------
    # STRENGTHS
    # --------------------------------

    strengths_list = []

    if skills_score >= 18:
        strengths_list.append("Strong technical skills")
    elif skills_score >= 10:
        strengths_list.append("Good technical skills")

    if education_score >= 12:
        strengths_list.append("Good educational background")

    if projects_score >= 15:
        strengths_list.append("Good project experience")

    if experience_score >= 10:
        strengths_list.append("Relevant experience")

    if certifications_score >= 7:
        strengths_list.append("Relevant certifications")

    if completeness_score >= 12:
        strengths_list.append("Well-structured resume")

    if not strengths_list:
        strengths_list.append("Resume has room for improvement")


    # --------------------------------
    # SUGGESTIONS
    # --------------------------------

    suggestions = []

    if skills_score < 18:
        suggestions.append(
            "Improve your technical skills section and add relevant skills."
        )

    if education_score < 12:
        suggestions.append(
            "Add complete education details such as degree, branch and academic performance."
        )

    if projects_score < 15:
        suggestions.append(
            "Add 2-3 relevant projects with technologies and your contribution."
        )

    if experience_score < 10:
        suggestions.append(
            "Add internship, training or relevant practical experience if available."
        )

    if certifications_score < 7:
        suggestions.append(
            "Add relevant certifications or courses you have completed."
        )

    if completeness_score < 12:
        suggestions.append(
            "Improve resume completeness by adding clear sections and more relevant details."
        )

    if not suggestions:
        suggestions.append(
            "Excellent! Your resume is well-rounded and placement ready."
        )


    return {
        "resume_score": resume_score,

        "score_breakdown": {
            "skills": skills_score,
            "education": education_score,
            "projects": projects_score,
            "experience": experience_score,
            "certifications": certifications_score,
            "completeness": completeness_score
        },

        "strengths": strengths_list,

        "detected_skills": [
            skill.capitalize()
            for skill in strengths
        ],

        "missing_skills": [
            skill.capitalize()
            for skill in missing_skills
        ],

        "suggestions": suggestions,

        "profile": profile,

        "ai_recommendations": generate_ai_style_resume_recommendations(
            profile,
            strengths_list,
            missing_skills,
            target_role
        )
    }


def generate_ai_style_resume_recommendations(
    profile,
    strengths,
    missing_skills,
    target_role
):
    recommendations = []

    # Skill recommendations
    if missing_skills:
        recommendations.append(
            f"For the {target_role} role, focus on learning: "
            + ", ".join(missing_skills[:5])
            + "."
        )

    # Project recommendations
    if len(profile.get("projects", [])) == 0:
        recommendations.append(
            "Add at least 2 practical projects related to your target role."
        )
    elif len(profile.get("projects", [])) < 2:
        recommendations.append(
            "Consider adding one more role-relevant project to strengthen your resume."
        )

    # Certification recommendations
    if len(profile.get("certifications", [])) == 0:
        recommendations.append(
            "Add relevant technical certifications or course completions."
        )

    # Experience recommendations
    if len(profile.get("experience", [])) == 0:
        recommendations.append(
            "Add internship, training, hackathon, or practical experience "
            "where applicable."
        )

    # Education recommendations
    if len(profile.get("education", [])) == 0:
        recommendations.append(
            "Make your education details clear, including degree, branch, "
            "college, and relevant academic information."
        )

    # Strength-based recommendation
    if strengths:
        recommendations.append(
            "Highlight your strongest skills clearly in the Skills and Projects sections."
        )

    # General resume improvement
    recommendations.append(
        "Use measurable results in project and experience descriptions "
        "whenever possible."
    )

    return recommendations


def generate_placement_recommendations(
    resume_text: str,
    target_role: str,
    resume_score: float
):
    text = resume_text.lower()
    role = target_role.lower()

    role_skills = {
        "software developer": [
            "Python",
            "Java",
            "JavaScript",
            "DSA",
            "SQL",
            "DBMS",
            "Git"
        ],
        "frontend developer": [
            "HTML",
            "CSS",
            "JavaScript",
            "React",
            "Git"
        ],
        "backend developer": [
            "Python",
            "Java",
            "FastAPI",
            "SQL",
            "PostgreSQL",
            "REST API",
            "Git"
        ],
        "data analyst": [
            "Python",
            "SQL",
            "Excel",
            "Power BI",
            "Statistics"
        ],
        "data scientist": [
            "Python",
            "SQL",
            "Machine Learning",
            "Statistics",
            "Pandas",
            "NumPy"
        ]
    }

    selected_skills = role_skills["software developer"]

    for role_name, skills in role_skills.items():
        if role_name in role:
            selected_skills = skills
            break

    detected_skills = [
        skill
        for skill in selected_skills
        if skill.lower() in text
    ]

    missing_skills = [
        skill
        for skill in selected_skills
        if skill not in detected_skills
    ]

    recommendations = []

    if missing_skills:
        recommendations.append(
            f"Learn or strengthen: {', '.join(missing_skills[:4])}"
        )

    if "dsa" in [skill.lower() for skill in selected_skills]:
        if "data structures" not in text and "algorithm" not in text:
            recommendations.append(
                "Practice Data Structures and Algorithms regularly"
            )

    if "git" in [skill.lower() for skill in selected_skills]:
        if "github" not in text:
            recommendations.append(
                "Add GitHub projects to demonstrate practical experience"
            )

    if resume_score < 70:
        recommendations.append(
            "Improve resume completeness and project descriptions"
        )

    if not recommendations:
        recommendations.append(
            "Your resume matches the selected role well. "
            "Continue improving projects and interview preparation."
        )

    return {
        "target_role": target_role,
        "resume_score": resume_score,
        "detected_skills": detected_skills,
        "missing_skills": missing_skills,
        "recommendations": recommendations
    }

def generate_real_ai_resume_analysis(
    resume_text: str,
    target_role: str,
    detected_skills: list,
    missing_skills: list
):
    if not openai_client:
        return None

    try:
        resume_text = resume_text[:12000]

        prompt = f"""
You are PlacementPro AI, an expert resume reviewer and placement coach.

Target role:
{target_role}

Detected skills:
{", ".join(detected_skills) if detected_skills else "None detected"}

Missing skills for this role:
{", ".join(missing_skills) if missing_skills else "None"}

Resume text:
{resume_text}

Analyze this resume for the target role above.

Give:
1. Resume strengths
2. Missing or weak skills
3. Project improvements
4. Certification suggestions
5. Experience improvements
6. ATS improvements
7. Overall recommendation

Be constructive and concise.
Do not invent facts about the candidate that aren't in the resume.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a professional resume reviewer and placement coach. "
                "Give practical, accurate and encouraging feedback."
            ),
            input=prompt,
            max_output_tokens=800
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Resume AI service error: {error}")
        return None


@app.post("/resume/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    target_role: str = Form("Software Developer"),
    student_id: int = Form(...),
    current_student_id: int = Depends(get_current_student)
):

    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    file_path = await validate_and_save_resume(file)

    text = extract_text(file_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from this file"
        )

    result = analyze_resume_text(text, target_role)

    ai_resume_analysis = generate_real_ai_resume_analysis(
        text,
        target_role,
        result["detected_skills"],
        result["missing_skills"]
    )

    result["ai_resume_analysis"] = ai_resume_analysis

    db = SessionLocal()

    analysis = ResumeAnalysis(
        student_id=student_id,
        filename=file.filename,
        target_role=target_role,
        detected_skills=json.dumps(result["detected_skills"]),
        resume_score=result["resume_score"],
        skills_score=result["score_breakdown"]["skills"],
        education_score=result["score_breakdown"]["education"],
        projects_score=result["score_breakdown"]["projects"],
        experience_score=result["score_breakdown"]["experience"],
        certifications_score=result["score_breakdown"]["certifications"],
        completeness_score=result["score_breakdown"]["completeness"]
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    db.close()

    return result


@app.post("/resume/recommendations")
async def get_resume_recommendations(
    file: UploadFile = File(...),
    target_role: str = Form("Software Developer"),
    student_id: int = Form(...),
    current_student_id: int = Depends(get_current_student)
):

    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    file_path = await validate_and_save_resume(file)

    text = extract_text(file_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from this file"
        )

    analysis = analyze_resume_text(text, target_role)

    recommendations = generate_placement_recommendations(
        text,
        target_role,
        analysis["resume_score"]
    )

    return recommendations


@app.get("/resume/history/{student_id}")
def get_resume_history(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    analyses = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.student_id == student_id)
        .order_by(ResumeAnalysis.id.desc())
        .all()
    )

    result = []

    for analysis in analyses:
        result.append({
            "id": analysis.id,
            "filename": analysis.filename,
            "target_role": analysis.target_role,
            "resume_score": analysis.resume_score,
            "skills": analysis.skills_score,
            "education": analysis.education_score,
            "projects": analysis.projects_score,
            "experience": analysis.experience_score,
            "certifications": analysis.certifications_score,
            "completeness": analysis.completeness_score
        })

    db.close()

    return result


INITIAL_CODING_QUESTIONS = [
    {
        "id": 1,
        "question": "What is the output of: print(2 + 3)?",
        "options": ["4", "5", "6", "23"],
        "answer": "5",
        "category": "Programming",
        "difficulty": "Easy"
    },
    {
        "id": 2,
        "question": "Which data structure follows LIFO?",
        "options": ["Queue", "Stack", "Array", "Tree"],
        "answer": "Stack",
        "category": "Data Structures",
        "difficulty": "Easy"
    },
    {
        "id": 3,
        "question": "Which keyword is used to define a function in Python?",
        "options": ["func", "function", "def", "define"],
        "answer": "def",
        "category": "Programming",
        "difficulty": "Easy"
    },
    {
        "id": 4,
        "question": "Which language is commonly used for Android development?",
        "options": ["HTML", "Kotlin", "SQL", "CSS"],
        "answer": "Kotlin",
        "category": "General",
        "difficulty": "Medium"
    },
    {
        "id": 5,
        "question": "What is the time complexity of binary search?",
        "options": ["O(n)", "O(n²)", "O(log n)", "O(1)"],
        "answer": "O(log n)",
        "category": "Algorithms",
        "difficulty": "Medium"
    }
]


def seed_coding_questions():
    db = SessionLocal()

    existing_count = db.query(CodingQuestion).count()

    if existing_count == 0:
        for q in INITIAL_CODING_QUESTIONS:
            question = CodingQuestion(
                id=q["id"],
                question=q["question"],
                option_a=q["options"][0],
                option_b=q["options"][1],
                option_c=q["options"][2],
                option_d=q["options"][3],
                answer=q["answer"],
                category=q["category"],
                difficulty=q["difficulty"]
            )

            db.add(question)

        db.commit()

    db.close()


seed_coding_questions()


@app.get("/coding/questions")
def get_coding_questions():
    db = SessionLocal()

    db_questions = db.query(CodingQuestion).all()

    questions = []

    for question in db_questions:
        questions.append({
            "id": question.id,
            "question": question.question,
            "options": [
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d
            ],
            "category": question.category,
            "difficulty": question.difficulty
        })

    db.close()

    return questions


@app.get("/coding/{student_id}")
def get_coding_progress(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    total_questions = db.query(CodingQuestion).count()

    correct_count = (
        db.query(CodingAttempt)
        .filter(
            CodingAttempt.student_id == student_id,
            CodingAttempt.is_correct == 1
        )
        .count()
    )

    coding_score = 0

    if total_questions > 0:
        coding_score = min(
            round((correct_count / total_questions) * 100),
            100
        )

    db.close()

    return {
        "problems_solved": correct_count,
        "total_problems": total_questions,
        "coding_score": coding_score
    }


@app.post("/coding/{student_id}")
def update_coding_progress(
    student_id: int,
    problems_solved: int
):
    db = SessionLocal()

    progress = (
        db.query(CodingProgress)
        .filter(CodingProgress.student_id == student_id)
        .first()
    )

    total_questions = db.query(CodingQuestion).count()

    if not progress:
        progress = CodingProgress(
            student_id=student_id,
            problems_solved=problems_solved,
            total_problems=total_questions,
            coding_score=round(
                (problems_solved / total_questions) * 100
            ) if total_questions > 0 else 0
        )
        db.add(progress)
    else:
        progress.problems_solved = problems_solved
        progress.total_problems = total_questions
        progress.coding_score = round(
            (problems_solved / total_questions) * 100
        ) if total_questions > 0 else 0

    db.commit()
    db.close()

    return {
        "message": "Coding progress updated",
        "coding_score": problems_solved
    }


@app.post("/coding/{student_id}/submit")
def submit_coding_answer(
    student_id: int,
    question_id: int,
    answer: str,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    question = (
        db.query(CodingQuestion)
        .filter(CodingQuestion.id == question_id)
        .first()
    )

    if not question:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Question not found"
        )

    existing_attempt = (
        db.query(CodingAttempt)
        .filter(
            CodingAttempt.student_id == student_id,
            CodingAttempt.question_id == question_id
        )
        .first()
    )

    if existing_attempt:
        total_questions = db.query(CodingQuestion).count()

        correct_count = (
            db.query(CodingAttempt)
            .filter(
                CodingAttempt.student_id == student_id,
                CodingAttempt.is_correct == 1
            )
            .count()
        )

        coding_score = 0

        if total_questions > 0:
            coding_score = min(
                round((correct_count / total_questions) * 100),
                100
            )

        db.close()

        return {
            "correct": bool(existing_attempt.is_correct),
            "correct_answer": question.answer,
            "coding_score": coding_score,
            "problems_solved": correct_count,
            "already_attempted": True,
            "message": "You have already attempted this question."
        }

    is_correct = answer == question.answer

    attempt = CodingAttempt(
        student_id=student_id,
        question_id=question_id,
        is_correct=1 if is_correct else 0
    )

    db.add(attempt)
    db.commit()

    total_questions = db.query(CodingQuestion).count()

    correct_count = (
        db.query(CodingAttempt)
        .filter(
            CodingAttempt.student_id == student_id,
            CodingAttempt.is_correct == 1
        )
        .count()
    )

    coding_score = 0

    if total_questions > 0:
        coding_score = min(
            round((correct_count / total_questions) * 100),
            100
        )

    progress = (
        db.query(CodingProgress)
        .filter(CodingProgress.student_id == student_id)
        .first()
    )

    if not progress:
        progress = CodingProgress(
            student_id=student_id,
            problems_solved=correct_count,
            total_problems=total_questions,
            coding_score=coding_score
        )
        db.add(progress)
    else:
        progress.problems_solved = correct_count
        progress.total_problems = total_questions
        progress.coding_score = coding_score

    db.commit()

    result = {
        "correct": is_correct,
        "correct_answer": question.answer,
        "coding_score": coding_score,
        "problems_solved": correct_count,
        "already_attempted": False
    }

    db.close()

    return result


@app.get("/coding/attempted/{student_id}")
def get_attempted_questions(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(CodingAttempt.question_id)
        .filter(CodingAttempt.student_id == student_id)
        .all()
    )

    attempted_ids = [attempt.question_id for attempt in attempts]

    db.close()

    return {
        "attempted_question_ids": attempted_ids
    }


@app.get("/coding/results/{student_id}")
def get_coding_results(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(CodingAttempt)
        .filter(CodingAttempt.student_id == student_id)
        .all()
    )

    results = {}

    for attempt in attempts:
        results[str(attempt.question_id)] = bool(attempt.is_correct)

    db.close()

    return results


@app.get("/coding/stats/{student_id}")
def get_coding_stats(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    total_questions = db.query(CodingQuestion).count()

    attempts = (
        db.query(CodingAttempt)
        .filter(CodingAttempt.student_id == student_id)
        .all()
    )

    attempted = len(attempts)

    correct = sum(
        1 for attempt in attempts
        if attempt.is_correct == 1
    )

    accuracy = 0

    if attempted > 0:
        accuracy = round((correct / attempted) * 100)

    coding_score = 0

    if total_questions > 0:
        coding_score = min(
            round((correct / total_questions) * 100),
            100
        )

    db.close()

    return {
        "total_questions": total_questions,
        "attempted": attempted,
        "correct": correct,
        "accuracy": accuracy,
        "coding_score": coding_score
    }


INITIAL_APTITUDE_QUESTIONS = [
    {
        "question": "What is 25% of 200?",
        "option_a": "25",
        "option_b": "50",
        "option_c": "75",
        "option_d": "100",
        "answer": "50",
        "category": "Percentage",
        "difficulty": "Easy"
    },
    {
        "question": "If 5 pens cost ₹50, what is the cost of 1 pen?",
        "option_a": "₹5",
        "option_b": "₹10",
        "option_c": "₹15",
        "option_d": "₹20",
        "answer": "₹10",
        "category": "Ratio & Proportion",
        "difficulty": "Easy"
    },
    {
        "question": "What is the average of 10, 20 and 30?",
        "option_a": "15",
        "option_b": "20",
        "option_c": "25",
        "option_d": "30",
        "answer": "20",
        "category": "Average",
        "difficulty": "Easy"
    },
    {
        "question": "A train travels 120 km in 2 hours. What is its speed?",
        "option_a": "40 km/h",
        "option_b": "50 km/h",
        "option_c": "60 km/h",
        "option_d": "80 km/h",
        "answer": "60 km/h",
        "category": "Time & Speed",
        "difficulty": "Easy"
    },
    {
        "question": "What is the next number: 2, 4, 8, 16, ?",
        "option_a": "20",
        "option_b": "24",
        "option_c": "32",
        "option_d": "36",
        "answer": "32",
        "category": "Number Series",
        "difficulty": "Medium"
    }
]


def seed_aptitude_questions():
    db = SessionLocal()

    if db.query(AptitudeQuestion).count() == 0:
        for q in INITIAL_APTITUDE_QUESTIONS:
            db.add(AptitudeQuestion(**q))
        db.commit()

    db.close()


seed_aptitude_questions()


@app.get("/aptitude/questions")
def get_aptitude_questions():
    db = SessionLocal()

    questions = db.query(AptitudeQuestion).all()

    result = []

    for q in questions:
        result.append({
            "id": q.id,
            "question": q.question,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "category": q.category,
            "difficulty": q.difficulty
        })

    db.close()

    return result


@app.get("/aptitude/attempted/{student_id}")
def get_aptitude_attempted(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(AptitudeAttempt.question_id)
        .filter(AptitudeAttempt.student_id == student_id)
        .all()
    )

    attempted_ids = [attempt.question_id for attempt in attempts]

    db.close()

    return {
        "attempted_question_ids": attempted_ids
    }


@app.get("/aptitude/results/{student_id}")
def get_aptitude_results(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(AptitudeAttempt)
        .filter(AptitudeAttempt.student_id == student_id)
        .all()
    )

    results = {}

    for attempt in attempts:
        results[str(attempt.question_id)] = bool(attempt.is_correct)

    db.close()

    return results


@app.get("/aptitude/stats/{student_id}")
def get_aptitude_stats(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    total_questions = db.query(AptitudeQuestion).count()

    attempts = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.student_id == student_id
    ).all()

    attempted = len(attempts)

    correct = sum(
        1 for attempt in attempts
        if attempt.is_correct == 1
    )

    accuracy = (
        round((correct / attempted) * 100)
        if attempted > 0 else 0
    )

    aptitude_score = (
        min(round((correct / total_questions) * 100), 100)
        if total_questions > 0 else 0
    )

    db.close()

    return {
        "total_questions": total_questions,
        "attempted": attempted,
        "correct": correct,
        "accuracy": accuracy,
        "aptitude_score": aptitude_score
    }


@app.post("/aptitude/{student_id}/submit")
def submit_aptitude_answer(
    student_id: int,
    question_id: int,
    answer: str,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    question = db.query(AptitudeQuestion).filter(
        AptitudeQuestion.id == question_id
    ).first()

    if not question:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Question not found"
        )

    # Prevent duplicate attempts
    existing = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.student_id == student_id,
        AptitudeAttempt.question_id == question_id
    ).first()

    if existing:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Question already attempted"
        )

    is_correct = 1 if answer.strip().lower() == question.answer.strip().lower() else 0

    attempt = AptitudeAttempt(
        student_id=student_id,
        question_id=question_id,
        is_correct=is_correct
    )

    db.add(attempt)
    db.commit()

    # Calculate current progress
    attempts = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.student_id == student_id
    ).all()

    questions_attempted = len(attempts)
    correct_answers = sum(
        1 for a in attempts if a.is_correct == 1
    )

    total_questions = db.query(AptitudeQuestion).count()

    aptitude_score = (
        min(round((correct_answers / total_questions) * 100), 100)
        if total_questions > 0
        else 0
    )

    # Update aptitude progress
    progress = db.query(AptitudeProgress).filter(
        AptitudeProgress.student_id == student_id
    ).first()

    if not progress:
        progress = AptitudeProgress(
            student_id=student_id
        )
        db.add(progress)

    progress.questions_attempted = questions_attempted
    progress.correct_answers = correct_answers
    progress.aptitude_score = aptitude_score

    db.commit()

    result = {
        "correct": bool(is_correct),
        "correct_answer": question.answer,
        "questions_attempted": questions_attempted,
        "correct_answers": correct_answers,
        "aptitude_score": aptitude_score
    }

    db.close()

    return result


@app.get("/aptitude/{student_id}")
def get_aptitude_progress(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    progress = (
        db.query(AptitudeProgress)
        .filter(AptitudeProgress.student_id == student_id)
        .first()
    )

    if not progress:
        db.close()
        return {
            "questions_attempted": 0,
            "correct_answers": 0,
            "aptitude_score": 0
        }

    result = {
        "questions_attempted": progress.questions_attempted,
        "correct_answers": progress.correct_answers,
        "aptitude_score": progress.aptitude_score
    }

    db.close()

    return result


@app.post("/aptitude/{student_id}")
def update_aptitude_progress(
    student_id: int,
    questions_attempted: int,
    correct_answers: int
):
    db = SessionLocal()

    if questions_attempted <= 0:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Questions attempted must be greater than 0"
        )

    score = round(
        (correct_answers / questions_attempted) * 100
    )

    progress = (
        db.query(AptitudeProgress)
        .filter(AptitudeProgress.student_id == student_id)
        .first()
    )

    if not progress:
        progress = AptitudeProgress(
            student_id=student_id,
            questions_attempted=questions_attempted,
            correct_answers=correct_answers,
            aptitude_score=score
        )
        db.add(progress)
    else:
        progress.questions_attempted = questions_attempted
        progress.correct_answers = correct_answers
        progress.aptitude_score = score

    db.commit()
    db.close()

    return {
        "message": "Aptitude progress updated",
        "aptitude_score": score
    }


INITIAL_INTERVIEW_QUESTIONS = [
    {
        "question": "Tell me about yourself.",
        "category": "HR",
        "difficulty": "Easy"
    },
    {
        "question": "What are your strengths?",
        "category": "HR",
        "difficulty": "Easy"
    },
    {
        "question": "Why should we hire you?",
        "category": "HR",
        "difficulty": "Medium"
    },
    {
        "question": "Where do you see yourself in five years?",
        "category": "HR",
        "difficulty": "Medium"
    },
    {
        "question": "What is Object-Oriented Programming?",
        "category": "OOP",
        "difficulty": "Easy"
    },
    {
        "question": "What is inheritance?",
        "category": "OOP",
        "difficulty": "Easy"
    },
    {
        "question": "What is normalization in DBMS?",
        "category": "DBMS",
        "difficulty": "Medium"
    },
    {
        "question": "What is a primary key?",
        "category": "DBMS",
        "difficulty": "Easy"
    },
    {
        "question": "What is the difference between Python and Java?",
        "category": "Python & Java",
        "difficulty": "Medium"
    },
    {
        "question": "What is a stack?",
        "category": "DSA",
        "difficulty": "Easy"
    },
    {
        "question": "What is a queue?",
        "category": "DSA",
        "difficulty": "Easy"
    },
    {
        "question": "What is the time complexity of binary search?",
        "category": "DSA",
        "difficulty": "Medium"
    },
    {
        "question": "Explain your final year or major project.",
        "category": "Technical",
        "difficulty": "Medium"
    },
    {
        "question": "Why do you want to become a software developer?",
        "category": "Behavioral",
        "difficulty": "Easy"
    },
    {
        "question": "How do you handle pressure or deadlines?",
        "category": "Behavioral",
        "difficulty": "Medium"
    }
]


def seed_interview_questions():
    db = SessionLocal()

    if db.query(InterviewQuestion).count() == 0:
        for q in INITIAL_INTERVIEW_QUESTIONS:
            db.add(InterviewQuestion(**q))
        db.commit()

    db.close()


seed_interview_questions()


ROLE_SPECIFIC_INTERVIEW_QUESTIONS = [
    # Data Analyst
    {
        "question": "What is the difference between INNER JOIN and LEFT JOIN in SQL?",
        "category": "data",
        "difficulty": "Medium"
    },
    {
        "question": "What is the difference between WHERE and HAVING clauses?",
        "category": "sql",
        "difficulty": "Medium"
    },
    {
        "question": "How would you handle missing values in a dataset?",
        "category": "data",
        "difficulty": "Easy"
    },
    # Frontend Developer
    {
        "question": "What is the difference between props and state in React?",
        "category": "frontend",
        "difficulty": "Easy"
    },
    {
        "question": "What is the Virtual DOM?",
        "category": "frontend",
        "difficulty": "Medium"
    },
    {
        "question": "What is the difference between CSS Flexbox and Grid?",
        "category": "frontend",
        "difficulty": "Medium"
    },
    # Backend Developer
    {
        "question": "What is the difference between authentication and authorization?",
        "category": "backend",
        "difficulty": "Easy"
    },
    {
        "question": "What is a REST API?",
        "category": "backend",
        "difficulty": "Easy"
    },
    {
        "question": "What is database indexing and why is it useful?",
        "category": "backend",
        "difficulty": "Medium"
    },
    # Data Scientist
    {
        "question": "What is the difference between supervised and unsupervised learning?",
        "category": "machine learning",
        "difficulty": "Easy"
    },
    {
        "question": "What is overfitting in machine learning?",
        "category": "machine learning",
        "difficulty": "Medium"
    },
    {
        "question": "What is the difference between classification and regression?",
        "category": "data science",
        "difficulty": "Easy"
    }
]


def seed_role_specific_interview_questions():
    db = SessionLocal()

    existing_questions = {
        q.question for q in db.query(InterviewQuestion).all()
    }

    for q in ROLE_SPECIFIC_INTERVIEW_QUESTIONS:
        if q["question"] not in existing_questions:
            db.add(InterviewQuestion(**q))

    db.commit()
    db.close()


seed_role_specific_interview_questions()


@app.get("/interview/questions")
def get_interview_questions(
    target_role: str = "Software Developer",
    current_student_id: int = Depends(get_current_student)
):
    db = SessionLocal()

    role = target_role.lower()

    role_categories = {
        "software developer": [
            "technical",
            "coding",
            "hr"
        ],
        "frontend developer": [
            "frontend",
            "technical",
            "hr"
        ],
        "backend developer": [
            "backend",
            "technical",
            "hr"
        ],
        "data analyst": [
            "data",
            "sql",
            "hr"
        ],
        "data scientist": [
            "data science",
            "machine learning",
            "hr"
        ]
    }

    categories = role_categories.get(
        role,
        role_categories["software developer"]
    )

    questions = (
        db.query(InterviewQuestion)
        .filter(func.lower(InterviewQuestion.category).in_(categories))
        .all()
    )

    db.close()

    return [
        {
            "id": question.id,
            "question": question.question,
            "category": question.category,
            "difficulty": question.difficulty
        }
        for question in questions
    ]


@app.post("/interview/{student_id}/submit")
def submit_interview_answer(
    student_id: int,
    question_id: int,
    answer: str,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    question = db.query(InterviewQuestion).filter(
        InterviewQuestion.id == question_id
    ).first()

    if not question:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Interview question not found"
        )

    existing = db.query(InterviewAttempt).filter(
        InterviewAttempt.student_id == student_id,
        InterviewAttempt.question_id == question_id
    ).first()

    if existing:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Question already answered"
        )

    attempt = InterviewAttempt(
        student_id=student_id,
        question_id=question_id,
        answer=answer
    )

    db.add(attempt)
    db.commit()

    db.close()

    return {
        "message": "Answer submitted successfully",
        "question_id": question_id
    }


def evaluate_interview_answer(
    question: str,
    answer: str,
    category: str
):
    answer_text = answer.lower().strip()

    score = 0
    feedback = []

    # Basic answer quality
    word_count = len(answer_text.split())

    if word_count >= 40:
        score += 30
    elif word_count >= 20:
        score += 20
    elif word_count >= 10:
        score += 10
    else:
        feedback.append(
            "Try to provide a more detailed answer."
        )

    # Technical keywords
    technical_keywords = [
        "because",
        "example",
        "approach",
        "method",
        "solution",
        "performance",
        "advantage",
        "disadvantage"
    ]

    keyword_count = sum(
        1 for keyword in technical_keywords
        if keyword in answer_text
    )

    score += min(keyword_count * 5, 30)

    if keyword_count < 2:
        feedback.append(
            "Include concepts, reasoning, or examples "
            "to strengthen your answer."
        )

    # Category-specific evaluation
    if category.lower() in [
        "technical",
        "coding",
        "frontend",
        "backend",
        "sql",
        "data",
        "data science",
        "machine learning"
    ]:
        if any(
            word in answer_text
            for word in [
                "algorithm",
                "database",
                "code",
                "function",
                "data",
                "system",
                "implementation"
            ]
        ):
            score += 20
        else:
            feedback.append(
                "Mention relevant technical concepts "
                "or implementation details."
            )

    else:
        if any(
            word in answer_text
            for word in [
                "experience",
                "team",
                "project",
                "learn",
                "challenge",
                "result"
            ]
        ):
            score += 20
        else:
            feedback.append(
                "Support your answer with a real example "
                "from your experience."
            )

    score = min(score, 100)

    if score >= 80:
        feedback.insert(
            0,
            "Excellent answer. Your response is clear and relevant."
        )
    elif score >= 60:
        feedback.insert(
            0,
            "Good answer, but there is room for improvement."
        )
    else:
        feedback.insert(
            0,
            "Your answer needs more detail and explanation."
        )

    return {
        "score": score,
        "feedback": feedback
    }


def generate_interview_coaching(
    answer: str,
    score: int,
    category: str
):
    answer = answer.strip()

    strengths = []
    improvements = []
    action_items = []

    word_count = len(answer.split())

    if word_count >= 30:
        strengths.append("Your answer has reasonable detail.")
    elif word_count > 0:
        improvements.append("Add more explanation and supporting details.")
    else:
        improvements.append("Provide a complete answer instead of leaving it empty.")

    technical_keywords = {
        "technical": [
            "algorithm",
            "database",
            "api",
            "python",
            "java",
            "sql",
            "data structure",
            "object oriented"
        ],
        "behavioral": [
            "team",
            "communication",
            "leadership",
            "challenge",
            "problem",
            "result"
        ],
        "hr": [
            "career",
            "goal",
            "strength",
            "learning",
            "experience"
        ]
    }

    keywords = technical_keywords.get(
        category.lower(),
        technical_keywords["technical"]
    )

    matched_keywords = [
        keyword
        for keyword in keywords
        if keyword in answer.lower()
    ]

    if matched_keywords:
        strengths.append(
            "You included relevant concepts: "
            + ", ".join(matched_keywords[:4])
            + "."
        )
    else:
        improvements.append(
            "Include relevant technical or role-specific concepts."
        )

    if score >= 80:
        strengths.append("Your response covers the main expected points.")
    elif score >= 60:
        improvements.append(
            "Your answer is reasonable, but it can be more precise and structured."
        )
    else:
        improvements.append(
            "Strengthen the answer with a clear explanation, example, and conclusion."
        )

    action_items.append(
        "Use a simple structure: Point → Explanation → Example → Result."
    )

    if category.lower() == "behavioral":
        action_items.append(
            "For behavioral questions, use the STAR approach: Situation, Task, Action, Result."
        )

    return {
        "strengths": strengths,
        "improvements": improvements,
        "action_items": action_items,
        "matched_keywords": matched_keywords
    }


def generate_real_ai_interview_coaching(
    question: str,
    answer: str,
    score: int,
    category: str
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI, an expert technical interview coach.

Interview category:
{category}

Question:
{question}

Candidate answer:
{answer}

Current score:
{score}/100

Analyze the candidate's answer.

Give:
1. What was done well
2. What could be improved
3. A better approach for answering
4. Important points the candidate missed
5. A short action plan for improvement

Be constructive and concise.
Do not invent facts about the candidate.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a professional interview coach. "
                "Give practical, accurate and encouraging feedback."
            ),
            input=prompt,
            max_output_tokens=600
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Interview AI service error: {error}")
        return None


@app.post("/interview/evaluate")
def evaluate_answer(
    question_id: int,
    answer: str,
    current_student_id: int = Depends(get_current_student)
):
    db = SessionLocal()

    question = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.id == question_id)
        .first()
    )

    if not question:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Interview question not found"
        )

    result = evaluate_interview_answer(
        question.question,
        answer,
        question.category
    )

    coaching = generate_interview_coaching(
        answer,
        result["score"],
        question.category
    )

    real_ai_coaching = generate_real_ai_interview_coaching(
        question=question.question,
        answer=answer,
        score=result["score"],
        category=question.category
    )

    if real_ai_coaching:
        coaching["real_ai_analysis"] = real_ai_coaching
    else:
        coaching["real_ai_analysis"] = None

    result["coaching"] = coaching

    attempt = (
        db.query(InterviewAttempt)
        .filter(
            InterviewAttempt.student_id == current_student_id,
            InterviewAttempt.question_id == question_id
        )
        .first()
    )

    if attempt:
        attempt.score = result["score"]
        db.commit()

    db.close()

    return result


@app.get("/interview/stats/{student_id}")
def get_interview_stats(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(InterviewAttempt)
        .filter(InterviewAttempt.student_id == student_id)
        .all()
    )

    db.close()

    attempted = len(attempts)

    if attempted == 0:
        average_score = 0
    else:
        average_score = sum(
            attempt.score for attempt in attempts
        ) / attempted

    return {
        "attempted": attempted,
        "average_score": round(average_score, 2)
    }


def generate_interview_recommendations(
    average_score: float,
    attempted: int
):
    recommendations = []

    if attempted == 0:
        recommendations.append(
            "Start practicing interview questions regularly."
        )

    elif average_score < 40:
        recommendations.extend([
            "Focus on understanding the fundamentals.",
            "Practice explaining your answers clearly.",
            "Use examples when answering questions."
        ])

    elif average_score < 60:
        recommendations.extend([
            "Improve the depth of your technical answers.",
            "Practice more interview questions.",
            "Explain your reasoning step by step."
        ])

    elif average_score < 80:
        recommendations.extend([
            "Your performance is good. Focus on advanced questions.",
            "Improve answer structure and confidence.",
            "Add practical project examples to your answers."
        ])

    else:
        recommendations.extend([
            "Excellent interview performance.",
            "Continue practicing advanced interview questions.",
            "Focus on company-specific interview preparation."
        ])

    return recommendations


@app.get("/interview/recommendations/{student_id}")
def interview_recommendations(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    attempts = (
        db.query(InterviewAttempt)
        .filter(
            InterviewAttempt.student_id == student_id
        )
        .all()
    )

    db.close()

    attempted = len(attempts)

    if attempted == 0:
        average_score = 0
    else:
        average_score = sum(
            attempt.score for attempt in attempts
        ) / attempted

    recommendations = generate_interview_recommendations(
        average_score,
        attempted
    )

    return {
        "average_score": round(average_score, 2),
        "attempted": attempted,
        "recommendations": recommendations
    }


@app.get("/projects/{student_id}")
def get_project_progress(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    progress = (
        db.query(ProjectProgress)
        .filter(ProjectProgress.student_id == student_id)
        .first()
    )

    if not progress:
        db.close()
        return {
            "projects_completed": 0,
            "projects_target": 5,
            "project_score": 0
        }

    result = {
        "projects_completed": progress.projects_completed,
        "projects_target": progress.projects_target,
        "project_score": progress.project_score
    }

    db.close()

    return result


@app.post("/projects/{student_id}")
def update_project_progress(
    student_id: int,
    projects_completed: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    if projects_completed < 0:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Projects completed cannot be negative"
        )

    projects_target = 5

    score = min(
        round((projects_completed / projects_target) * 100),
        100
    )

    progress = (
        db.query(ProjectProgress)
        .filter(ProjectProgress.student_id == student_id)
        .first()
    )

    if not progress:
        progress = ProjectProgress(
            student_id=student_id,
            projects_completed=projects_completed,
            projects_target=projects_target,
            project_score=score
        )
        db.add(progress)
    else:
        progress.projects_completed = projects_completed
        progress.projects_target = projects_target
        progress.project_score = score

    db.commit()
    db.close()

    return {
        "message": "Project progress updated",
        "project_score": score
    }


# --------------------------------------------------------------------
# Step 10 — Companies Module
# --------------------------------------------------------------------

INITIAL_COMPANIES = [
    {
        "name": "Amazon",
        "role": "Software Development Engineer",
        "package": "₹12-18 LPA",
        "eligibility": "60% or 6.0 CGPA, no active backlogs",
        "skills": "Java, Python, DSA, System Design, SQL"
    },
    {
        "name": "Microsoft",
        "role": "Software Engineer",
        "package": "₹15-20 LPA",
        "eligibility": "65% or 6.5 CGPA, no active backlogs",
        "skills": "C++, Java, DSA, OOP, Cloud"
    },
    {
        "name": "TCS",
        "role": "Assistant System Engineer",
        "package": "₹3.5-7 LPA",
        "eligibility": "60% throughout academics, no active backlogs",
        "skills": "Java, SQL, Communication, Aptitude"
    },
    {
        "name": "Infosys",
        "role": "Systems Engineer",
        "package": "₹3.6-8 LPA",
        "eligibility": "60% throughout academics, no active backlogs",
        "skills": "Java, Python, DBMS, Aptitude"
    },
    {
        "name": "Wipro",
        "role": "Project Engineer",
        "package": "₹3.5-6.5 LPA",
        "eligibility": "60% throughout academics",
        "skills": "Java, SQL, Communication"
    },
    {
        "name": "Accenture",
        "role": "Associate Software Engineer",
        "package": "₹4.5-9 LPA",
        "eligibility": "60% throughout academics, no active backlogs",
        "skills": "Java, SQL, Cloud Basics, Communication"
    },
    {
        "name": "Cognizant",
        "role": "Programmer Analyst",
        "package": "₹4-6.5 LPA",
        "eligibility": "60% throughout academics",
        "skills": "Java, Python, SQL, DSA"
    },
    {
        "name": "Deloitte",
        "role": "Analyst",
        "package": "₹6-10 LPA",
        "eligibility": "65% or 6.5 CGPA",
        "skills": "SQL, Excel, Communication, Problem Solving"
    },
    {
        "name": "Zoho",
        "role": "Software Developer",
        "package": "₹4-8 LPA",
        "eligibility": "No CGPA cutoff, strong DSA required",
        "skills": "Java, C, DSA, Problem Solving"
    },
    {
        "name": "Freshworks",
        "role": "Software Engineer",
        "package": "₹8-14 LPA",
        "eligibility": "70% or 7.0 CGPA, no active backlogs",
        "skills": "JavaScript, React, Node.js, DSA"
    }
]


def seed_companies():
    db = SessionLocal()

    if db.query(Company).count() == 0:
        for c in INITIAL_COMPANIES:
            db.add(Company(**c))
        db.commit()

    db.close()


seed_companies()


@app.get("/companies")
def get_companies():
    db = SessionLocal()

    companies = db.query(Company).all()

    result = []

    for c in companies:
        result.append({
            "id": c.id,
            "name": c.name,
            "role": c.role,
            "package": c.package,
            "eligibility": c.eligibility,
            "skills": c.skills
        })

    db.close()

    return result


@app.get("/companies/{company_id}")
def get_company(company_id: int):
    db = SessionLocal()

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    result = {
        "id": company.id,
        "name": company.name,
        "role": company.role,
        "package": company.package,
        "eligibility": company.eligibility,
        "skills": company.skills
    }

    db.close()

    return result


# --------------------------------------------------------------------
# Step 32 — Company Preparation Module
# --------------------------------------------------------------------

APTITUDE_SKILL_KEYWORDS = ("aptitude", "quantitative", "reasoning")
INTERVIEW_SKILL_KEYWORDS = ("system design", "communication", "problem solving")


def build_preparation_focus(skills_string):
    coding_focus = []
    aptitude_focus = []
    interview_focus = []

    for raw_skill in skills_string.split(","):
        skill = raw_skill.strip()

        if not skill:
            continue

        normalized = skill.lower()

        if normalized in APTITUDE_SKILL_KEYWORDS:
            aptitude_focus.append(skill)
        elif normalized in INTERVIEW_SKILL_KEYWORDS:
            interview_focus.append(skill)
        else:
            coding_focus.append(skill)

    return coding_focus, aptitude_focus, interview_focus


@app.get("/companies/{company_id}/preparation")
def get_company_preparation(company_id: int):
    db = SessionLocal()

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    coding_focus, aptitude_focus, interview_focus = build_preparation_focus(
        company.skills
    )

    checklist = [
        {"skill": raw_skill.strip()}
        for raw_skill in company.skills.split(",")
        if raw_skill.strip()
    ]

    result = {
        "company": company.name,
        "role": company.role,
        "coding_focus": coding_focus,
        "aptitude_focus": aptitude_focus,
        "interview_focus": interview_focus,
        "checklist": checklist
    }

    db.close()

    return result


@app.put("/companies/{company_id}/preparation/{skill}")
def update_company_preparation(
    company_id: int,
    skill: str,
    completed: bool,
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    record = (
        db.query(CompanyPreparation)
        .filter(
            CompanyPreparation.student_id == student_id,
            CompanyPreparation.company_id == company_id,
            CompanyPreparation.skill == skill
        )
        .first()
    )

    if record:
        record.completed = 1 if completed else 0
    else:
        record = CompanyPreparation(
            student_id=student_id,
            company_id=company_id,
            skill=skill,
            completed=1 if completed else 0
        )
        db.add(record)

    db.commit()
    db.close()

    return {
        "skill": skill,
        "completed": completed
    }


@app.get("/companies/{company_id}/preparation/progress")
def get_company_preparation_progress(
    company_id: int,
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    progress = (
        db.query(CompanyPreparation)
        .filter(
            CompanyPreparation.student_id == student_id,
            CompanyPreparation.company_id == company_id,
            CompanyPreparation.completed == 1
        )
        .all()
    )

    db.close()

    return {
        "completed_skills": [
            item.skill for item in progress
        ]
    }


@app.get("/students/{student_id}/company-preparation-summary")
def get_company_preparation_summary(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    companies = db.query(Company).all()

    summary = []

    for company in companies:
        total_skills = len([
            skill.strip()
            for skill in company.skills.split(",")
            if skill.strip()
        ])

        completed_count = (
            db.query(CompanyPreparation)
            .filter(
                CompanyPreparation.student_id == student_id,
                CompanyPreparation.company_id == company.id,
                CompanyPreparation.completed == 1
            )
            .count()
        )

        if completed_count == 0:
            continue

        percentage = (
            round((completed_count / total_skills) * 100)
            if total_skills > 0 else 0
        )

        summary.append({
            "company_id": company.id,
            "company": company.name,
            "role": company.role,
            "completed_skills": completed_count,
            "total_skills": total_skills,
            "percentage": percentage
        })

    db.close()

    summary.sort(key=lambda item: item["percentage"], reverse=True)

    average_percentage = (
        round(sum(item["percentage"] for item in summary) / len(summary))
        if summary else 0
    )

    return {
        "companies": summary,
        "companies_started": len(summary),
        "average_percentage": average_percentage
    }


# --------------------------------------------------------------------
# Step 33 — Company Match Engine
# --------------------------------------------------------------------

def check_company_eligibility(company, student):
    eligibility = company.eligibility.lower()

    # Zoho-style companies with no CGPA cutoff
    if "no cgpa cutoff" in eligibility:
        return True

    # Extract CGPA requirement
    cgpa_required = None

    import re

    match = re.search(
        r"(\d+(?:\.\d+)?)\s*cgpa",
        eligibility
    )

    if match:
        cgpa_required = float(match.group(1))

    # If no CGPA requirement is found
    if cgpa_required is None:
        return True

    return student.cgpa >= cgpa_required


def normalize_skill(skill):
    skill = skill.strip().lower()

    aliases = {
        "oops": "oop",
        "object oriented programming": "oop",
        "object-oriented programming": "oop",

        "js": "javascript",
        "reactjs": "react",
        "react.js": "react",

        "nodejs": "node.js",
        "node": "node.js",

        "postgres": "postgresql",
        "postgres sql": "postgresql",

        "data structures and algorithms": "dsa",

        "machine learning": "machine learning",
        "ml": "machine learning",

        "artificial intelligence": "ai",

        "rest": "rest api",
        "restful api": "rest api",
    }

    return aliases.get(skill, skill)


def get_resume_skills(student_id, db):
    latest_resume = (
        db.query(ResumeAnalysis)
        .filter(
            ResumeAnalysis.student_id == student_id
        )
        .order_by(ResumeAnalysis.id.desc())
        .first()
    )

    if not latest_resume:
        return []

    if not latest_resume.detected_skills:
        return []

    try:
        skills = json.loads(
            latest_resume.detected_skills
        )

        if isinstance(skills, list):
            return skills

    except (json.JSONDecodeError, TypeError):
        pass

    return []


def calculate_company_match(company, student, db):

    # -----------------------------------------
    # Company required skills
    # -----------------------------------------

    required_skills = [
        skill.strip()
        for skill in company.skills.split(",")
        if skill.strip()
    ]

    # -----------------------------------------
    # Resume detected skills
    # -----------------------------------------

    resume_skills = get_resume_skills(
        student.id,
        db
    )

    # -----------------------------------------
    # Manually completed preparation skills
    # -----------------------------------------

    completed = (
        db.query(CompanyPreparation)
        .filter(
            CompanyPreparation.student_id == student.id,
            CompanyPreparation.company_id == company.id,
            CompanyPreparation.completed == 1
        )
        .all()
    )

    preparation_skills = [
        item.skill
        for item in completed
    ]

    # -----------------------------------------
    # Combine skills
    # -----------------------------------------

    student_skills = {
        normalize_skill(skill)
        for skill in (
            resume_skills +
            preparation_skills
        )
    }

    # -----------------------------------------
    # Match skills
    # -----------------------------------------

    matched_skills = []
    missing_skills = []

    for required_skill in required_skills:

        normalized_required = normalize_skill(
            required_skill
        )

        if normalized_required in student_skills:
            matched_skills.append(required_skill)
        else:
            missing_skills.append(required_skill)

    # -----------------------------------------
    # Skill match percentage
    # -----------------------------------------

    skill_match_score = (
        round(
            len(matched_skills)
            / len(required_skills)
            * 100
        )
        if required_skills
        else 0
    )

    # -----------------------------------------
    # Resume score
    # -----------------------------------------

    latest_resume = (
        db.query(ResumeAnalysis)
        .filter(
            ResumeAnalysis.student_id == student.id
        )
        .order_by(ResumeAnalysis.id.desc())
        .first()
    )

    resume_score = (
        latest_resume.resume_score
        if latest_resume
        else 0
    )

    # -----------------------------------------
    # Other preparation scores
    # -----------------------------------------

    scores = calculate_student_scores(
        student.id,
        db
    )

    coding_score = scores["coding_score"]
    aptitude_score = scores["aptitude_score"]
    project_score = scores["project_score"]
    interview_score = scores["interview_score"]

    # -----------------------------------------
    # Eligibility
    # -----------------------------------------

    eligible = check_company_eligibility(
        company,
        student
    )

    # -----------------------------------------
    # CGPA component
    # -----------------------------------------

    cgpa_score = 100 if eligible else 0

    # -----------------------------------------
    # Overall company match
    # -----------------------------------------

    match_score = round(
        skill_match_score * 0.50
        + resume_score * 0.15
        + cgpa_score * 0.10
        + coding_score * 0.10
        + aptitude_score * 0.05
        + project_score * 0.05
        + interview_score * 0.05
    )

    # -----------------------------------------
    # Recommendations
    # -----------------------------------------

    recommendations = []

    if missing_skills:
        for skill in missing_skills[:3]:
            recommendations.append(
                f"Strengthen your {skill} skills "
                f"to improve this company match."
            )

    if coding_score < 60:
        recommendations.append(
            "Improve your coding and DSA preparation."
        )

    if aptitude_score < 60:
        recommendations.append(
            "Practice aptitude and logical reasoning."
        )

    if project_score < 60:
        recommendations.append(
            "Add or improve practical projects."
        )

    if interview_score < 60:
        recommendations.append(
            "Practice technical and HR interviews."
        )

    if not recommendations:
        recommendations.append(
            "Your profile covers the main requirements. "
            "Continue practicing company-specific questions."
        )

    return {
        "company": company.name,
        "role": company.role,
        "package": company.package,

        "eligible": eligible,

        "match_score": match_score,

        "skill_match_score": skill_match_score,

        "resume_score": resume_score,
        "coding_score": coding_score,
        "aptitude_score": aptitude_score,
        "project_score": project_score,
        "interview_score": interview_score,

        "matched_skills": matched_skills,
        "missing_skills": missing_skills,

        "recommendations": recommendations
    }


@app.get("/companies/{company_id}/match")
def get_company_match(
    company_id: int,
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not company or not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Company or student not found"
        )

    result = calculate_company_match(company, student, db)

    db.close()

    return result


# --------------------------------------------------------------------
# Step 11 — Projects Module (real project tracking)
# --------------------------------------------------------------------

@app.get("/projects/{student_id}/list")
def list_projects(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    projects = (
        db.query(Project)
        .filter(Project.student_id == student_id)
        .order_by(Project.id.desc())
        .all()
    )

    result = []

    for p in projects:
        result.append({
            "id": p.id,
            "student_id": p.student_id,
            "name": p.name,
            "description": p.description,
            "technology": p.technology,
            "status": p.status
        })

    db.close()

    return result


@app.post("/projects/{student_id}/add")
def add_project(
    student_id: int,
    project: ProjectCreate,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    new_project = Project(
        student_id=student_id,
        name=project.name,
        description=project.description,
        technology=project.technology,
        status=project.status
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    db.close()

    return {
        "message": "Project added successfully",
        "project_id": new_project.id
    }


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    project: ProjectCreate,
    current_student_id: int = Depends(get_current_student)
):
    db = SessionLocal()

    existing_project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not existing_project:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if existing_project.student_id != current_student_id:
        db.close()
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    existing_project.name = project.name
    existing_project.description = project.description
    existing_project.technology = project.technology
    existing_project.status = project.status

    db.commit()
    db.close()

    return {
        "message": "Project updated successfully",
        "project_id": project_id
    }


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    current_student_id: int = Depends(get_current_student)
):
    db = SessionLocal()

    existing_project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not existing_project:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if existing_project.student_id != current_student_id:
        db.close()
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db.delete(existing_project)
    db.commit()
    db.close()

    return {
        "message": "Project deleted successfully"
    }


# --------------------------------------------------------------------
# Step 12 — Progress Dashboard
# --------------------------------------------------------------------

def calculate_student_scores(student_id, db):
    # Coding
    total_coding = db.query(CodingQuestion).count()
    correct_coding = db.query(CodingAttempt).filter(
        CodingAttempt.student_id == student_id,
        CodingAttempt.is_correct == 1
    ).count()

    coding_score = (
        min(round((correct_coding / total_coding) * 100), 100)
        if total_coding > 0 else 0
    )

    # Aptitude
    total_aptitude = db.query(AptitudeQuestion).count()
    correct_aptitude = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.student_id == student_id,
        AptitudeAttempt.is_correct == 1
    ).count()

    aptitude_score = (
        min(round((correct_aptitude / total_aptitude) * 100), 100)
        if total_aptitude > 0 else 0
    )

    # Resume
    resume = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.student_id == student_id
    ).order_by(
        ResumeAnalysis.id.desc()
    ).first()

    resume_score = resume.resume_score if resume else 0

    # Projects
    completed_projects = db.query(Project).filter(
        Project.student_id == student_id,
        Project.status == "Completed"
    ).count()

    project_score = min(round((completed_projects / 5) * 100), 100)

    # Interview
    interview_attempts = db.query(InterviewAttempt).filter(
        InterviewAttempt.student_id == student_id
    ).all()

    interview_score = (
        round(
            sum(attempt.score for attempt in interview_attempts)
            / len(interview_attempts)
        )
        if interview_attempts else 0
    )

    return {
        "resume_score": resume_score,
        "coding_score": coding_score,
        "aptitude_score": aptitude_score,
        "project_score": project_score,
        "interview_score": interview_score,
        "completed_projects": completed_projects
    }


@app.get("/progress/{student_id}")
def get_progress(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    scores = calculate_student_scores(student_id, db)

    resume_score = scores["resume_score"]
    coding_score = scores["coding_score"]
    aptitude_score = scores["aptitude_score"]
    project_score = scores["project_score"]
    interview_score = scores["interview_score"]
    completed_projects = scores["completed_projects"]

    # Interview attempt counts (for display, not scoring)
    interview_total = db.query(InterviewQuestion).count()

    interview_attempted = db.query(InterviewAttempt).filter(
        InterviewAttempt.student_id == student_id
    ).count()

    db.close()

    readiness_score = round(
        resume_score * 0.20 +
        coding_score * 0.25 +
        aptitude_score * 0.15 +
        project_score * 0.20 +
        interview_score * 0.20
    )

    return {
        "resume_score": resume_score,
        "coding_score": coding_score,
        "aptitude_score": aptitude_score,
        "project_score": project_score,
        "interview_score": interview_score,
        "interview_attempted": interview_attempted,
        "interview_total": interview_total,
        "completed_projects": completed_projects,
        "readiness_score": readiness_score
    }

# --------------------------------------------------------------------
# Step 36 — Skill Gap Analyzer
# --------------------------------------------------------------------

TARGET_ROLE_SKILLS = {
    "software developer": [
        "Python",
        "Java",
        "JavaScript",
        "DSA",
        "SQL",
        "DBMS",
        "Git"
    ],
    "frontend developer": [
        "HTML",
        "CSS",
        "JavaScript",
        "React",
        "Git"
    ],
    "backend developer": [
        "Python",
        "Java",
        "FastAPI",
        "SQL",
        "PostgreSQL",
        "REST API",
        "Git"
    ],
    "data analyst": [
        "Python",
        "SQL",
        "Excel",
        "Power BI",
        "Statistics"
    ],
    "data scientist": [
        "Python",
        "SQL",
        "Machine Learning",
        "Statistics",
        "Pandas",
        "NumPy"
    ]
}

HIGH_PRIORITY_SKILLS = [
    "dsa",
    "system design",
    "problem solving",
    "machine learning"
]

MEDIUM_PRIORITY_SKILLS = [
    "sql",
    "dbms",
    "react",
    "java",
    "python",
    "javascript"
]


def analyze_skill_gap(student, db):
    """Compare the skills a student's target role implies against the
    skills companies hiring for that role actually ask for."""

    target_role = (student.target_role or "").lower()

    student_skills = TARGET_ROLE_SKILLS.get(
        target_role,
        TARGET_ROLE_SKILLS["software developer"]
    )

    required_skills = set()

    companies = db.query(Company).all()

    for company in companies:
        company_role = company.role.lower()

        if (
            target_role in company_role
            or company_role in target_role
            or target_role == "software developer"
        ):
            for skill in company.skills.split(","):
                skill = skill.strip()

                if skill:
                    required_skills.add(skill)

    matched_skills = []
    skill_gaps = []

    for skill in sorted(required_skills):
        matched = any(
            skill.lower() == student_skill.lower()
            for student_skill in student_skills
        )

        if matched:
            matched_skills.append(skill)
            continue

        if skill.lower() in HIGH_PRIORITY_SKILLS:
            priority = "High"
        elif skill.lower() in MEDIUM_PRIORITY_SKILLS:
            priority = "Medium"
        else:
            priority = "Low"

        skill_gaps.append({
            "skill": skill,
            "priority": priority
        })

    priority_order = {"High": 0, "Medium": 1, "Low": 2}

    skill_gaps.sort(
        key=lambda gap: priority_order.get(gap["priority"], 3)
    )

    return {
        "target_role": student.target_role,
        "total_required": len(required_skills),
        "total_matched": len(matched_skills),
        "total_missing": len(skill_gaps),
        "matched_skills": matched_skills,
        "skill_gaps": skill_gaps
    }


@app.get("/students/{student_id}/skill-gap")
def get_skill_gap(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    result = analyze_skill_gap(student, db)

    db.close()

    return result


# --------------------------------------------------------------------
# Step 35 — Daily Placement Plan
# --------------------------------------------------------------------

def generate_daily_plan(
    resume_score,
    coding_score,
    aptitude_score,
    project_score,
    interview_score,
    skill_gaps=None
):
    if skill_gaps is None:
        skill_gaps = []

    areas = [
        ("Resume", resume_score),
        ("Coding & DSA", coding_score),
        ("Aptitude", aptitude_score),
        ("Projects", project_score),
        ("Interview", interview_score)
    ]

    areas.sort(key=lambda item: item[1])

    plan = []

    # Add important skill gaps first
    for gap in skill_gaps:
        skill = gap["skill"]
        priority = gap["priority"]

        if priority == "High":
            duration = 45
        elif priority == "Medium":
            duration = 30
        else:
            duration = 20

        plan.append({
            "area": skill,
            "score": 0,
            "priority": priority,
            "task": (
                f"Spend {duration} minutes "
                f"learning and practicing {skill}."
            )
        })

    # Add weakest performance areas
    for area, score in areas:
        if score < 40:
            priority = "High"
            duration = 45
        elif score < 60:
            priority = "Medium"
            duration = 30
        elif score < 80:
            priority = "Low"
            duration = 20
        else:
            priority = "Maintain"
            duration = 15

        plan.append({
            "area": area,
            "score": score,
            "priority": priority,
            "task": (
                f"Spend {duration} minutes "
                f"practicing {area}."
            )
        })

    # Remove duplicate areas
    unique_plan = []
    seen = set()

    for item in plan:
        if item["area"] not in seen:
            unique_plan.append(item)
            seen.add(item["area"])

    return unique_plan[:5]


def generate_real_ai_dashboard_insight(
    target_role: str,
    scores: dict,
    missing_skills: list,
    readiness_score: int
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI.

Student target role:
{target_role}

Placement scores:
Resume: {scores["Resume"]}%
Coding: {scores["Coding"]}%
Aptitude: {scores["Aptitude"]}%
Projects: {scores["Projects"]}%
Interview: {scores["Interview"]}%

Overall readiness:
{readiness_score}%

Missing skills:
{", ".join(missing_skills[:10]) if missing_skills else "None"}

Generate a concise placement dashboard insight.

Include:
- Biggest improvement opportunity
- What the student should focus on today
- One practical action

Keep it under 100 words.
Use only the information provided.
Do not make claims about placement guarantees.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a concise and practical placement advisor."
            ),
            input=prompt,
            max_output_tokens=250
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Dashboard AI error: {error}")
        return None


@app.get("/students/{student_id}/dashboard-insight")
def dashboard_insight(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores_data = calculate_student_scores(student_id, db)

    scores = {
        "Resume": scores_data["resume_score"],
        "Coding": scores_data["coding_score"],
        "Aptitude": scores_data["aptitude_score"],
        "Projects": scores_data["project_score"],
        "Interview": scores_data["interview_score"],
    }

    readiness_score = round(
        scores["Resume"] * 0.20 +
        scores["Coding"] * 0.25 +
        scores["Aptitude"] * 0.15 +
        scores["Projects"] * 0.20 +
        scores["Interview"] * 0.20
    )

    gap_analysis = analyze_skill_gap(student, db)

    missing_skills = [
        gap["skill"] for gap in gap_analysis["skill_gaps"]
    ]

    db.close()

    cache_key = f"dashboard_insight_{student_id}_{readiness_score}"

    cached = get_ai_cache(cache_key)

    if cached:
        return {
            "readiness_score": readiness_score,
            "scores": scores,
            "missing_skills": missing_skills,
            "ai_insight": cached
        }

    insight = generate_real_ai_dashboard_insight(
        target_role=student.target_role,
        scores=scores,
        missing_skills=missing_skills,
        readiness_score=readiness_score
    )

    if insight:
        set_ai_cache(cache_key, insight)

    return {
        "readiness_score": readiness_score,
        "scores": scores,
        "missing_skills": missing_skills,
        "ai_insight": insight
    }


def generate_real_ai_daily_plan(
    target_role: str,
    scores: dict,
    missing_skills: list
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI, a placement preparation planner.

Target role:
{target_role}

Current scores:
Resume: {scores["Resume"]}%
Coding: {scores["Coding"]}%
Aptitude: {scores["Aptitude"]}%
Projects: {scores["Projects"]}%
Interview: {scores["Interview"]}%

Missing skills:
{", ".join(missing_skills[:10]) if missing_skills else "None"}

Create a focused daily placement plan.

Give exactly 5 tasks.

For each task include:
- Task
- Area
- Approximate time
- Expected outcome

Prioritize the weakest areas and important missing skills.

Keep the total plan realistic for one day.
Do not claim that completing the plan guarantees placement.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a practical placement preparation planner. "
                "Create concise and actionable daily tasks."
            ),
            input=prompt,
            max_output_tokens=600
        )

        result = parse_ai_json(response.output_text)

        if result and isinstance(result.get("tasks"), list):
            return json.dumps(result)

        return response.output_text.strip()

    except Exception as error:
        print(f"Daily plan AI error: {error}")
        return None


@app.get("/students/{student_id}/daily-plan")
def get_daily_plan(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)

    gap_analysis = analyze_skill_gap(student, db)

    plan = generate_daily_plan(
        scores["resume_score"],
        scores["coding_score"],
        scores["aptitude_score"],
        scores["project_score"],
        scores["interview_score"],
        gap_analysis["skill_gaps"]
    )

    capitalized_scores = {
        "Resume": scores["resume_score"],
        "Coding": scores["coding_score"],
        "Aptitude": scores["aptitude_score"],
        "Projects": scores["project_score"],
        "Interview": scores["interview_score"],
    }

    missing_skills = [
        gap["skill"] for gap in gap_analysis["skill_gaps"]
    ]

    ai_daily_plan = generate_real_ai_daily_plan(
        target_role=student.target_role,
        scores=capitalized_scores,
        missing_skills=missing_skills
    )

    db.close()

    return {
        "student": student.name,
        "plan": plan,
        "target_role": student.target_role,
        "scores": capitalized_scores,
        "missing_skills": missing_skills,
        "ai_daily_plan": ai_daily_plan,
        "fallback_plan": plan
    }


# --------------------------------------------------------------------
# Step 37 — Advanced AI Placement Recommendations
# --------------------------------------------------------------------

def generate_advanced_recommendations(
    student,
    resume_score,
    coding_score,
    aptitude_score,
    project_score,
    interview_score,
    skill_gaps
):
    recommendations = []

    scores = {
        "Resume": resume_score,
        "Coding & DSA": coding_score,
        "Aptitude": aptitude_score,
        "Projects": project_score,
        "Interview": interview_score
    }

    # Find weakest area
    weakest_area = min(
        scores,
        key=scores.get
    )

    weakest_score = scores[weakest_area]

    if weakest_score < 40:
        recommendations.append({
            "priority": "High",
            "area": weakest_area,
            "message": (
                f"{weakest_area} is currently your weakest area "
                f"at {weakest_score}%. Give it your highest priority."
            )
        })

    elif weakest_score < 60:
        recommendations.append({
            "priority": "Medium",
            "area": weakest_area,
            "message": (
                f"Improve your {weakest_area} score from "
                f"{weakest_score}% to at least 60%."
            )
        })

    # Skill gap recommendations
    high_priority_skills = [
        gap["skill"]
        for gap in skill_gaps
        if gap["priority"] == "High"
    ]

    if high_priority_skills:
        recommendations.append({
            "priority": "High",
            "area": "Skill Gap",
            "message": (
                "Focus on these high-priority skills: "
                + ", ".join(high_priority_skills)
            )
        })

    # Coding
    if coding_score < 60:
        recommendations.append({
            "priority": "High",
            "area": "Coding",
            "message": (
                "Practice DSA and coding problems regularly. "
                "Focus on arrays, strings, searching and sorting first."
            )
        })

    # Aptitude
    if aptitude_score < 60:
        recommendations.append({
            "priority": "Medium",
            "area": "Aptitude",
            "message": (
                "Practice quantitative aptitude and logical reasoning "
                "to improve your placement test performance."
            )
        })

    # Resume
    if resume_score < 60:
        recommendations.append({
            "priority": "High",
            "area": "Resume",
            "message": (
                "Improve your resume by adding relevant technical "
                "skills, projects and measurable achievements."
            )
        })

    # Projects
    if project_score < 60:
        recommendations.append({
            "priority": "Medium",
            "area": "Projects",
            "message": (
                "Build more practical projects related to your "
                f"target role: {student.target_role}."
            )
        })

    # Interview
    if interview_score < 60:
        recommendations.append({
            "priority": "Medium",
            "area": "Interview",
            "message": (
                "Practice technical and HR interview questions. "
                "Use your projects as examples when answering."
            )
        })

    # Strong performance
    if all(score >= 80 for score in scores.values()):
        recommendations.append({
            "priority": "Maintain",
            "area": "Overall",
            "message": (
                "Your placement profile is strong. "
                "Focus on company-specific preparation and advanced questions."
            )
        })

    return recommendations


def generate_career_roadmap(
    target_role: str,
    resume_score: int,
    coding_score: int,
    aptitude_score: int,
    project_score: int,
    interview_score: int,
    missing_skills: list
):
    roadmap = []

    # Week 1 - Resume
    if resume_score < 80:
        roadmap.append({
            "week": "Week 1",
            "focus": "Resume Improvement",
            "tasks": [
                "Improve resume structure and readability",
                "Highlight technical skills and projects",
                "Add measurable project achievements"
            ]
        })
    else:
        roadmap.append({
            "week": "Week 1",
            "focus": "Resume Optimization",
            "tasks": [
                "Review resume for role relevance",
                "Improve project descriptions",
                "Keep resume updated"
            ]
        })

    # Week 2 - Coding
    if coding_score < 80:
        roadmap.append({
            "week": "Week 2",
            "focus": "Coding & DSA",
            "tasks": [
                "Practice arrays and strings",
                "Practice searching and sorting",
                "Solve coding problems regularly"
            ]
        })
    else:
        roadmap.append({
            "week": "Week 2",
            "focus": "Advanced Coding",
            "tasks": [
                "Solve medium-level problems",
                "Improve time complexity",
                "Practice interview-style problems"
            ]
        })

    # Week 3 - Skills
    skill_tasks = missing_skills[:5] if missing_skills else [
        "Strengthen your existing technical skills"
    ]

    roadmap.append({
        "week": "Week 3",
        "focus": f"{target_role} Skills",
        "tasks": skill_tasks
    })

    # Week 4 - Projects
    if project_score < 80:
        roadmap.append({
            "week": "Week 4",
            "focus": "Projects",
            "tasks": [
                "Build one role-relevant project",
                "Add the project to GitHub",
                "Document the technologies used"
            ]
        })
    else:
        roadmap.append({
            "week": "Week 4",
            "focus": "Project Enhancement",
            "tasks": [
                "Improve an existing project",
                "Add meaningful features",
                "Prepare a project explanation for interviews"
            ]
        })

    # Week 5 - Aptitude
    if aptitude_score < 80:
        roadmap.append({
            "week": "Week 5",
            "focus": "Aptitude",
            "tasks": [
                "Practice quantitative aptitude",
                "Practice logical reasoning",
                "Take timed aptitude tests"
            ]
        })

    # Week 6 - Interview
    if interview_score < 80:
        roadmap.append({
            "week": "Week 6",
            "focus": "Interview Preparation",
            "tasks": [
                "Practice technical questions",
                "Practice HR questions",
                "Improve answer structure and communication"
            ]
        })
    else:
        roadmap.append({
            "week": "Week 6",
            "focus": "Interview Practice",
            "tasks": [
                "Take mock interviews",
                "Practice explaining projects",
                "Practice role-specific questions"
            ]
        })

    return roadmap


def generate_real_ai_career_roadmap(
    target_role: str,
    resume_score: int,
    coding_score: int,
    aptitude_score: int,
    project_score: int,
    interview_score: int,
    missing_skills: list
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI, an expert placement preparation coach.

Target role:
{target_role}

Current scores:
Resume: {resume_score}%
Coding & DSA: {coding_score}%
Aptitude: {aptitude_score}%
Projects: {project_score}%
Interview: {interview_score}%

Missing skills for this role:
{", ".join(missing_skills[:15]) if missing_skills else "None detected"}

Create a personalized week-by-week placement preparation roadmap
(4 to 6 weeks) for this student, based on their actual scores and
skill gaps above.

For each week, provide:
1. A short focus area title
2. 3-4 concrete, actionable tasks

Prioritize the student's weakest areas first.
Be realistic for a college student preparing for placements.
Do not invent scores or skills that weren't provided above.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a practical placement preparation coach. "
                "Give a realistic, personalized week-by-week roadmap."
            ),
            input=prompt,
            max_output_tokens=900
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Career roadmap AI service error: {error}")
        return None


@app.get("/students/{student_id}/career-roadmap")
def get_career_roadmap(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)

    resume_score = scores["resume_score"]
    coding_score = scores["coding_score"]
    aptitude_score = scores["aptitude_score"]
    project_score = scores["project_score"]
    interview_score = scores["interview_score"]

    missing_skills = []

    latest_resume = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.student_id == student_id)
        .order_by(ResumeAnalysis.id.desc())
        .first()
    )

    if latest_resume:
        try:
            detected = json.loads(
                latest_resume.detected_skills or "[]"
            )

            role_skills = ROLE_SKILLS.get(
                (student.target_role or "").lower().strip(),
                ROLE_SKILLS["software developer"]
            )

            missing_skills = [
                skill for skill in role_skills
                if skill not in detected
            ]

        except (json.JSONDecodeError, TypeError):
            missing_skills = []

    roadmap = generate_career_roadmap(
        student.target_role,
        resume_score,
        coding_score,
        aptitude_score,
        project_score,
        interview_score,
        missing_skills
    )

    ai_roadmap = generate_real_ai_career_roadmap(
        target_role=student.target_role,
        resume_score=resume_score,
        coding_score=coding_score,
        aptitude_score=aptitude_score,
        project_score=project_score,
        interview_score=interview_score,
        missing_skills=missing_skills
    )

    db.close()

    return {
        "target_role": student.target_role,
        "roadmap": roadmap,
        "ai_roadmap": ai_roadmap
    }


def generate_project_suggestions(
    target_role: str,
    missing_skills: list,
    project_score: int
):
    suggestions = []

    role_projects = {
        "software developer": [
            "Online Coding Practice Platform",
            "Student Placement Management System",
            "Expense Tracker with Analytics",
            "AI-Powered Resume Analyzer"
        ],
        "frontend developer": [
            "Interactive Portfolio Dashboard",
            "E-Commerce Frontend",
            "Job Search Dashboard",
            "Real-Time Task Management UI"
        ],
        "backend developer": [
            "REST API for Placement Management",
            "Authentication and User Management API",
            "Online Book Management API",
            "Backend Analytics Dashboard"
        ],
        "full stack developer": [
            "Full Stack Job Portal",
            "College Placement Management System",
            "Project Collaboration Platform",
            "E-Learning Management System"
        ],
        "data analyst": [
            "Student Performance Analytics",
            "Placement Data Dashboard",
            "Sales Analytics Dashboard",
            "College Attendance Analysis"
        ]
    }

    projects = role_projects.get(
        (target_role or "").lower().strip(),
        role_projects["software developer"]
    )

    for project in projects[:4]:
        suggestions.append({
            "title": project,
            "reason": "Relevant to your target role",
            "skills": missing_skills[:4]
        })

    if project_score < 60:
        suggestions.insert(0, {
            "title": "Build a role-focused portfolio project",
            "reason": "Your project score indicates that adding a strong practical project could improve your profile.",
            "skills": missing_skills[:5]
        })

    return suggestions


def generate_real_ai_project_suggestions(
    target_role: str,
    missing_skills: list,
    project_score: int
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI, a professional software project mentor.

Target role:
{target_role}

Current project score:
{project_score}%

Missing skills:
{", ".join(missing_skills[:15]) if missing_skills else "None detected"}

Suggest 5 practical portfolio projects for this student.

For each project provide:
1. Project title
2. Problem it solves
3. Recommended technology stack
4. Skills it develops
5. Key features
6. Why it helps for the target role

Prioritize projects that help close the student's skill gaps.

Projects should be realistic for a college student.
Do not claim that a project guarantees placement.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are a practical software project mentor. "
                "Give realistic, placement-focused project ideas."
            ),
            input=prompt,
            max_output_tokens=1000
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Project AI service error: {error}")
        return None


@app.get("/students/{student_id}/project-suggestions")
def get_project_suggestions(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)
    project_score = scores["project_score"]

    missing_skills = []

    latest_resume = (
        db.query(ResumeAnalysis)
        .filter(
            ResumeAnalysis.student_id == student_id
        )
        .order_by(ResumeAnalysis.id.desc())
        .first()
    )

    if latest_resume:
        try:
            detected = json.loads(
                latest_resume.detected_skills or "[]"
            )

            role_skills = ROLE_SKILLS.get(
                (student.target_role or "").lower().strip(),
                ROLE_SKILLS["software developer"]
            )

            missing_skills = [
                skill
                for skill in role_skills
                if skill not in detected
            ]

        except (json.JSONDecodeError, TypeError):
            pass

    suggestions = generate_project_suggestions(
        student.target_role,
        missing_skills,
        project_score
    )

    real_ai_projects = generate_real_ai_project_suggestions(
        target_role=student.target_role,
        missing_skills=missing_skills,
        project_score=project_score
    )

    db.close()

    return {
        "target_role": student.target_role,
        "project_score": project_score,
        "missing_skills": missing_skills,
        "suggestions": suggestions,
        "fallback_projects": suggestions,
        "ai_project_suggestions": real_ai_projects
    }


def generate_placement_chat_response(
    message: str,
    student,
    resume_score: int,
    coding_score: int,
    aptitude_score: int,
    project_score: int,
    interview_score: int,
    missing_skills: list
):
    msg = message.lower().strip()

    scores = {
        "Resume": resume_score,
        "Coding": coding_score,
        "Aptitude": aptitude_score,
        "Projects": project_score,
        "Interview": interview_score,
    }

    weakest_area = min(scores, key=scores.get)
    weakest_score = scores[weakest_area]

    if any(word in msg for word in ["improve", "weak", "focus"]):
        return (
            f"Your current area needing the most attention is "
            f"{weakest_area} with a score of {weakest_score}%. "
            f"Start by practicing this area consistently and track your progress."
        )

    if "skill" in msg or "skills" in msg:
        if missing_skills:
            return (
                f"For your {student.target_role} target role, "
                f"focus on these skills: "
                + ", ".join(missing_skills[:6])
                + "."
            )

        return (
            f"Your detected skills currently cover the main requirements "
            f"for your {student.target_role} target role. "
            f"Continue strengthening them through projects and coding practice."
        )

    if "coding" in msg or "dsa" in msg:
        return (
            f"Your coding score is {coding_score}%. "
            f"Practice arrays, strings, searching, sorting and "
            f"problem-solving regularly. "
            f"Focus on understanding the approach before writing code."
        )

    if "resume" in msg:
        return (
            f"Your resume score is {resume_score}%. "
            f"Focus on strong project descriptions, relevant skills, "
            f"certifications and measurable achievements."
        )

    if "interview" in msg:
        return (
            f"Your interview score is {interview_score}%. "
            f"Practice technical, HR and behavioral questions. "
            f"For behavioral questions, structure answers using STAR."
        )

    if "project" in msg:
        return (
            f"Your project score is {project_score}%. "
            f"Build projects related to your target role: "
            f"{student.target_role}. "
            f"Add them to your resume and GitHub."
        )

    if "aptitude" in msg:
        return (
            f"Your aptitude score is {aptitude_score}%. "
            f"Practice quantitative aptitude, logical reasoning "
            f"and timed mock tests."
        )

    if any(word in msg for word in ["hello", "hi", "hey"]):
        return (
            f"Hi {student.name}! I'm your PlacementPro AI Assistant. "
            f"I can help with your resume, coding, aptitude, projects, "
            f"interviews and placement preparation."
        )

    return (
        f"You're preparing for a {student.target_role} role. "
        f"Your current weakest area is {weakest_area} "
        f"({weakest_score}%). "
        f"Ask me about your resume, coding, aptitude, projects, "
        f"interview preparation or missing skills."
    )


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_history: list = Field(default_factory=list)


@app.post("/students/{student_id}/placement-chat")
def placement_chat(
    student_id: int,
    data: ChatMessage,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)

    resume_score = scores["resume_score"]
    coding_score = scores["coding_score"]
    aptitude_score = scores["aptitude_score"]
    project_score = scores["project_score"]
    interview_score = scores["interview_score"]

    missing_skills = []

    latest_resume = (
        db.query(ResumeAnalysis)
        .filter(
            ResumeAnalysis.student_id == student_id
        )
        .order_by(ResumeAnalysis.id.desc())
        .first()
    )

    if latest_resume:
        try:
            detected = json.loads(
                latest_resume.detected_skills or "[]"
            )

            role_skills = ROLE_SKILLS.get(
                (student.target_role or "").lower().strip(),
                ROLE_SKILLS["software developer"]
            )

            missing_skills = [
                skill
                for skill in role_skills
                if skill not in detected
            ]

        except (json.JSONDecodeError, TypeError):
            pass

    response = generate_placement_chat_response(
        data.message,
        student,
        resume_score,
        coding_score,
        aptitude_score,
        project_score,
        interview_score,
        missing_skills
    )

    db.close()

    return {
        "message": response
    }


def generate_real_ai_learning_recommendations(
    target_role: str,
    scores: dict,
    missing_skills: list
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI.

Target role:
{target_role}

Scores:
{json.dumps(scores, indent=2)}

Missing skills:
{", ".join(missing_skills[:15]) if missing_skills else "None"}

Give 5 personalized learning recommendations.

For each recommendation provide:
- Topic
- Why it matters
- What to learn
- Practice suggestion

Prioritize weak areas.
Keep recommendations practical for a college student.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions="You are a practical software placement mentor.",
            input=prompt,
            max_output_tokens=700
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Learning AI error: {error}")
        return None


@app.get("/students/{student_id}/learning-recommendations")
def learning_recommendations(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores_data = calculate_student_scores(student_id, db)

    scores = {
        "Resume": scores_data["resume_score"],
        "Coding": scores_data["coding_score"],
        "Aptitude": scores_data["aptitude_score"],
        "Projects": scores_data["project_score"],
        "Interview": scores_data["interview_score"],
    }

    gap_analysis = analyze_skill_gap(student, db)

    missing_skills = [
        gap["skill"] for gap in gap_analysis["skill_gaps"]
    ]

    recommendations = generate_real_ai_learning_recommendations(
        student.target_role,
        scores,
        missing_skills
    )

    db.close()

    return {
        "recommendations": recommendations,
        "scores": scores,
        "missing_skills": missing_skills
    }


def generate_real_ai_readiness_analysis(
    target_role: str,
    scores: dict,
    readiness_score: int
):
    if not openai_client:
        return None

    try:
        prompt = f"""
You are PlacementPro AI.

Target role: {target_role}

Readiness score: {readiness_score}%

Scores:
{json.dumps(scores, indent=2)}

Explain the student's current placement readiness.

Include:
1. Current position
2. Strong areas
3. Areas needing improvement
4. Three actions to improve readiness
5. Short-term focus

Keep it under 150 words.
Do not guarantee placement.
"""

        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions="You are a professional placement readiness advisor.",
            input=prompt,
            max_output_tokens=400
        )

        return response.output_text.strip()

    except Exception as error:
        print(f"Readiness AI error: {error}")
        return None


@app.get("/students/{student_id}/readiness-analysis")
def readiness_analysis(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores_data = calculate_student_scores(student_id, db)

    scores = {
        "Resume": scores_data["resume_score"],
        "Coding": scores_data["coding_score"],
        "Aptitude": scores_data["aptitude_score"],
        "Projects": scores_data["project_score"],
        "Interview": scores_data["interview_score"],
    }

    readiness_score = round(
        scores["Resume"] * 0.20 +
        scores["Coding"] * 0.25 +
        scores["Aptitude"] * 0.15 +
        scores["Projects"] * 0.20 +
        scores["Interview"] * 0.20
    )

    analysis = generate_real_ai_readiness_analysis(
        student.target_role,
        scores,
        readiness_score
    )

    db.close()

    return {
        "readiness_score": readiness_score,
        "analysis": analysis,
        "scores": scores
    }


@app.get("/students/{student_id}/recommendations")
def get_advanced_recommendations(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)

    gap_analysis = analyze_skill_gap(student, db)

    recommendations = generate_advanced_recommendations(
        student,
        scores["resume_score"],
        scores["coding_score"],
        scores["aptitude_score"],
        scores["project_score"],
        scores["interview_score"],
        gap_analysis["skill_gaps"]
    )

    db.close()

    return {
        "target_role": student.target_role,
        "scores": {
            "resume": scores["resume_score"],
            "coding": scores["coding_score"],
            "aptitude": scores["aptitude_score"],
            "projects": scores["project_score"],
            "interview": scores["interview_score"]
        },
        "recommendations": recommendations
    }


# --------------------------------------------------------------------
# Step 38 — Placement Analytics
# --------------------------------------------------------------------

@app.get("/students/{student_id}/analytics")
def get_student_analytics(
    student_id: int,
    current_student_id: int = Depends(get_current_student)
):
    if student_id != current_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    db = SessionLocal()

    student = db.query(Student).filter(
        Student.id == student_id
    ).first()

    if not student:
        db.close()
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    scores = calculate_student_scores(student_id, db)

    db.close()

    score_map = {
        "Resume": scores["resume_score"],
        "Coding": scores["coding_score"],
        "Aptitude": scores["aptitude_score"],
        "Projects": scores["project_score"],
        "Interview": scores["interview_score"]
    }

    readiness_score = round(
        score_map["Resume"] * 0.20 +
        score_map["Coding"] * 0.25 +
        score_map["Aptitude"] * 0.15 +
        score_map["Projects"] * 0.20 +
        score_map["Interview"] * 0.20
    )

    average_score = round(
        sum(score_map.values()) / len(score_map)
    )

    strongest_area = max(score_map, key=score_map.get)
    weakest_area = min(score_map, key=score_map.get)

    return {
        "target_role": student.target_role,
        "readiness_score": readiness_score,
        "average_score": average_score,
        "scores": score_map,
        "strongest_area": {
            "area": strongest_area,
            "score": score_map[strongest_area]
        },
        "weakest_area": {
            "area": weakest_area,
            "score": score_map[weakest_area]
        }
    }