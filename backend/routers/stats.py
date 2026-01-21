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
    # Dynamic calculation of daily stats
    # 1. Get all tasks for user
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.is_deleted == False
    ).all()
    
    # 2. Group by date
    stats = {}
    
    for task in tasks:
        # Check creation date
        created_date = task.created_at.date()
        if created_date not in stats:
            stats[created_date] = {"total": 0, "completed": 0}
        stats[created_date]["total"] += 1
        
        # Check completion date
        if task.status.lower() == "completed" and task.completed_at:
            completed_date = task.completed_at.date()
            if completed_date not in stats:
                 # If task was completed on a day it wasn't created (unlikely for "total" logic but possible)
                 # We want to track performance on that day.
                 # Simplified logic: Total active tasks vs completed tasks on that day?
                 # User request: "percentage of tasks completed per day"
                 # Let's interpret as: Of the tasks that existed or were done that day, how many were finished?
                 # Simpler interpretation: (Tasks Completed on Date X) / (Total Tasks interacted with on Date X)?
                 
                 # Let's stick to the simplest robust metric:
                 # Daily Score = (Tasks Completed on that Day) / (Total Tasks Active on that Day)
                 # Active = Created on or before that day AND (Not completed OR completed on or after that day)
                 
                 # Actually, let's keep it very simple for now as per "percentage of tasks completed per day".
                 # Logic:
                 # For each date present in the data:
                 # Total = Count of tasks created on this date
                 # Completed = Count of tasks completed on this date
                 # Wait, that ignores backlog.
                 
                 # Let's try:
                 # For each day:
                 # Denominator: Tasks created on this day.
                 # Numerator: Tasks completed on this day (regardless of creation).
                 pass

            # We need a proper date range.
            # Let's just collect all 'events' by date.
            
    # Redoing logic for a cleaner "Progress Graph"
    # We will iterate through the last 30 days (or generic range)
    # But for now, let's just look at the dates we have data for.
    
    dates = set()
    for t in tasks:
        dates.add(t.created_at.date())
        if t.completed_at:
            dates.add(t.completed_at.date())
            
    sorted_dates = sorted(list(dates))
    
    result = []
    
    for d in sorted_dates:
        # Denominator: Total tasks created up to end of this day, that are not deleted.
        # OR just tasks created ON this day? "Percentage of tasks completed per day" implies (Completed / Total) for that day.
        # Let's go with: Total = Tasks created on this day.
        
        created_count = 0
        completed_count = 0
        
        for t in tasks:
            if t.created_at.date() == d:
                created_count += 1
            if t.completed_at and t.completed_at.date() == d:
                completed_count += 1
                
        # Handle edge case where 0 tasks created but some completed (backlog)
        # Avoid > 100% or division by zero.
        # If created_count is 0, we can't really calculate a 'daily completion rate' of new work.
        # Maybe Total = Created Today + Pending from before?
        
        # Let's use: Total interactions today = Created Today + Completed Today (if from backlog).
        # Denominator = max(created_count, completed_count) ? No.
        
        # Let's use the most standard "Daily Velocity" view:
        # Just return the raw counts, frontend deals with it?
        # User asked for "percentage".
        
        # Let's try: (Completed Today / Total Active Today)
        # Total Active = Created Today + (Pending from yesterday).
        
        # To avoid complexity without more requirements, let's implement:
        # % = (Tasks Completed Today / (Tasks Created Today + Tasks Completed Today that were created before)) * 100?
        
        # Let's simpler:
        # % = (Tasks Completed Today / Total Tasks in System)? No.
        
        # Simplest reasonable interpretation:
        # Denominator = Tasks that were "open" at any point today.
        # Numerator = Tasks completed today.
         
        total_active_today = 0
        for t in tasks:
            # Task existing today means: Created <= Today AND (Completed IS None OR Completed >= Today)
            if t.created_at.date() <= d:
                if t.completed_at is None or t.completed_at.date() >= d:
                    total_active_today += 1
        
        # Re-calc completed
        completed_today = 0
        for t in tasks:
            if t.completed_at and t.completed_at.date() == d:
                completed_today += 1

        percentage = 0.0
        if total_active_today > 0:
            percentage = (completed_today / total_active_today) * 100
        
        result.append({
            "date": d,
            "percentage": round(percentage, 1),
            "completed": completed_today,
            "total": total_active_today
        })
        
    return result
