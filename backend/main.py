import os
import shutil

from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document
import bcrypt
from jose import JWTError, jwt

load_dotenv(
    dotenv_path=Path(__file__).with_name(".env")
)

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

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


@app.get("/students")
def get_students():
    db = SessionLocal()

    students = db.query(Student).all()

    result = []

    for student in students:
        result.append({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "degree": student.degree,
            "branch": student.branch,
            "cgpa": student.cgpa,
            "target_role": student.target_role
        })

    db.close()

    return result


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

    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are allowed"
        )

    file_path = RESUME_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    text = extract_text(file_path)

    return {
        "message": "Resume uploaded successfully",
        "filename": file.filename,
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


def analyze_resume_text(text: str, target_role: str = "Software Developer"):

    lowered = text.lower()

    role_key = target_role.lower().strip()

    core_skills = ROLE_SKILLS.get(
        role_key,
        ROLE_SKILLS["software developer"]
    )

    words = text.split()

    # --------------------------------
    # 1. SKILLS - 25%
    # --------------------------------

    strengths = [
        skill for skill in core_skills
        if skill.lower() in lowered
    ]

    missing_skills = [
        skill for skill in core_skills
        if skill not in strengths
    ]

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

        "suggestions": suggestions
    }


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

    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are allowed"
        )

    file_path = RESUME_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    text = extract_text(file_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from this file"
        )

    result = analyze_resume_text(text, target_role)

    db = SessionLocal()

    analysis = ResumeAnalysis(
        student_id=student_id,
        filename=file.filename,
        target_role=target_role,
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


@app.get("/interview/questions")
def get_interview_questions():
    db = SessionLocal()

    questions = db.query(InterviewQuestion).all()

    result = []

    for q in questions:
        result.append({
            "id": q.id,
            "question": q.question,
            "category": q.category,
            "difficulty": q.difficulty
        })

    db.close()

    return result


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
    interview_total = db.query(InterviewQuestion).count()

    interview_attempted = db.query(InterviewAttempt).filter(
        InterviewAttempt.student_id == student_id
    ).count()

    db.close()

    readiness_score = round(
        resume_score * 0.25 +
        coding_score * 0.30 +
        aptitude_score * 0.20 +
        project_score * 0.25
    )

    return {
        "resume_score": resume_score,
        "coding_score": coding_score,
        "aptitude_score": aptitude_score,
        "project_score": project_score,
        "interview_attempted": interview_attempted,
        "interview_total": interview_total,
        "completed_projects": completed_projects,
        "readiness_score": readiness_score
    }