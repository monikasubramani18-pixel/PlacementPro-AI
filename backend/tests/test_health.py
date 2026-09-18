import sys
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200