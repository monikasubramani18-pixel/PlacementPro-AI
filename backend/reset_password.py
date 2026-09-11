import os
import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

email = input("Enter your email: ")
password = input("Enter your new password: ")

hashed_password = bcrypt.hashpw(
    password.encode("utf-8"),
    bcrypt.gensalt()
).decode("utf-8")

with engine.begin() as connection:
    result = connection.execute(
        text("""
            UPDATE public.students
            SET password = :password
            WHERE email = :email
        """),
        {
            "password": hashed_password,
            "email": email
        }
    )

if result.rowcount == 0:
    print("\n❌ No student found with this email.")
else:
    print("\n✅ Password updated successfully!")