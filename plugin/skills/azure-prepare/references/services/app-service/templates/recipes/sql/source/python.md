# SQL Database — Python — REFERENCE ONLY

## SQLAlchemy Setup

Add SQLAlchemy with Azure SQL and managed identity support to a FastAPI app.

### Requirements

Add to `requirements.txt`:

```
sqlalchemy>=2.0
pyodbc
azure-identity
fastapi
uvicorn
```

### Database Configuration

Create `database.py`:

```python
import os
import struct
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from azure.identity import ManagedIdentityCredential

def get_connection_string():
    """Build ODBC connection string with managed identity token."""
    conn_str = os.environ.get("AZURE_SQL_CONNECTION_STRING")
    if conn_str:
        return conn_str

    server = os.environ["AZURE_SQL_SERVER"]
    database = os.environ["AZURE_SQL_DATABASE"]
    client_id = os.environ.get("AZURE_CLIENT_ID", "")

    credential = ManagedIdentityCredential(client_id=client_id)
    token = credential.get_token("https://database.windows.net/.default")
    token_bytes = token.token.encode("utf-16-le")
    token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"Encrypt=yes;TrustServerCertificate=no;"
    )
    return conn_str, token_struct

class Base(DeclarativeBase):
    pass

def create_db_engine():
    conn_str, token_struct = get_connection_string()
    engine = create_engine(
        "mssql+pyodbc://",
        connect_args={
            "odbc_connect": conn_str,
            "attrs_before": {1256: token_struct},  # SQL_COPT_SS_ACCESS_TOKEN
        },
    )
    return engine

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### Models

Create `models.py`:

```python
from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class TodoItem(Base):
    __tablename__ = "todo_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    is_complete = Column(Boolean, default=False)
```

### API Endpoints

Add to `main.py` — do NOT replace existing routes:

```python
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import TodoItem
from pydantic import BaseModel

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TodoCreate(BaseModel):
    title: str
    is_complete: bool = False

@app.get("/api/todos")
def list_todos(db: Session = Depends(get_db)):
    return db.query(TodoItem).all()

@app.get("/api/todos/{todo_id}")
def get_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(TodoItem).filter(TodoItem.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    return todo

@app.post("/api/todos", status_code=201)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    db_todo = TodoItem(**todo.model_dump())
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo
```

### Local Development

For local development without managed identity, use SQL authentication:

```python
# .env (local only — never commit)
AZURE_SQL_CONNECTION_STRING=mssql+pyodbc://sa:password@localhost/myapp?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
```

## Files to Add

| File | Action |
|------|--------|
| `database.py` | Create — engine, session, managed identity token |
| `models.py` | Create — SQLAlchemy ORM models |
| `main.py` | Modify — add CRUD endpoints + DB dependency |
| `requirements.txt` | Modify — add sqlalchemy, pyodbc, azure-identity |

## Common Patterns

- Use `Depends(get_db)` for session lifecycle management
- Use `Base.metadata.create_all()` only for dev; use Alembic migrations in production
- Never store SQL passwords in app settings — use managed identity tokens
