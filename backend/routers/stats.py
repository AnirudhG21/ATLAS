from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database
from . import auth
from datetime import date, datetime 
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(
    prefix="/stats",
    tags=["stats"]
)

class DailyStatCreate(BaseModel):
    date: date
    percentage: float

class StatusCounts(BaseModel):
    pending: int = 0
    started: int = 0
    in_progress: int = 0
    completed: int = 0

@router.get("/counts", response_model=StatusCounts)
def get_status_counts(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Filter by owner and non-deleted
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id, models.Task.is_deleted == False).all()
    
    counts = {"Pending": 0, "Started": 0, "In Progress": 0, "Completed": 0}
    for task in tasks:
        # Standardize status key (capitalize)
        s = task.status
        # Handle case variations if any
        if s.lower() == "pending": s = "Pending"
        elif s.lower() == "started": s = "Started"
        elif s.lower() == "in progress": s = "In Progress"
        elif s.lower() == "completed": s = "Completed"
        
        if s in counts:
            counts[s] += 1
            
    return StatusCounts(
        pending=counts["Pending"],
        started=counts["Started"],
        in_progress=counts["In Progress"],
        completed=counts["Completed"]
    )

@router.get("/history")
def get_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Return all daily stats ordered by date
    stats = db.query(models.DailyStats).filter(models.DailyStats.user_id == current_user.id).order_by(models.DailyStats.date).all()
    
    # Also calculate Today's stats if not present? 
    # Logic: User said "If I dont mark anything... I should get 0%... until I edit the history"
    # But later "add tasks which I have completed" - impying auto calculation.
    # Let's provide raw stats. Frontend can fill gaps if needed, or backend can fill 0s.
    
    return stats

@router.post("/history")
def update_history(stat_update: DailyStatCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if entry exists
    existing = db.query(models.DailyStats).filter(
        models.DailyStats.user_id == current_user.id, 
        models.DailyStats.date == stat_update.date
    ).first()
    
    if existing:
        existing.percentage = stat_update.percentage
    else:
        new_stat = models.DailyStats(
            user_id=current_user.id,
            date=stat_update.date,
            percentage=stat_update.percentage
        )
        db.add(new_stat)
    
    db.commit()
    return {"message": "History updated"}
