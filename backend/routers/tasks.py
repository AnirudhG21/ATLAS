from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from models import User
import models, schemas, database
from . import auth

router = APIRouter(
    prefix="/tasks",
    tags=['Tasks']
)

@router.get("/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id, models.Task.is_deleted == False).offset(skip).limit(limit).all()
    return tasks

@router.get("/trash", response_model=List[schemas.Task])
def read_trash(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id, models.Task.is_deleted == True).offset(skip).limit(limit).all()
    return tasks

@router.post("/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    new_task = models.Task(**task.dict(), owner_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.put("/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task: schemas.TaskCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id)
    existing_task = task_query.first()
    
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id {task_id} not found")
    
    task_query.update(task.dict(), synchronize_session=False)
    db.commit()
    return task_query.first()

@router.post("/{task_id}/restore", response_model=schemas.Task)
def restore_task(task_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id)
    existing_task = task_query.first()
    
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id {task_id} not found")
    
    existing_task.is_deleted = False
    db.commit()
    db.refresh(existing_task)
    return existing_task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id)
    existing_task = task_query.first()

    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id {task_id} not found")

    existing_task.is_deleted = True
    db.commit()
    return

@router.delete("/{task_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_permanent(task_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == task_id, models.Task.owner_id == current_user.id)
    existing_task = task_query.first()

    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id {task_id} not found")

    task_query.delete(synchronize_session=False)
    db.commit()
    return
