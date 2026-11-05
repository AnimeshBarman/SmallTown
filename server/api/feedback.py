from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models.db_models import Feedback, Profile
from rate_limiter import rate_limit_feedback
from schemas.feedback_schema import FeedbackCreate, FeedbackResponse


router = APIRouter(redirect_slashes=False)


@router.get("", response_model=list[FeedbackResponse])
@router.get("/", response_model=list[FeedbackResponse])
def list_feedback(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )
    return db.query(Feedback).order_by(Feedback.created_at.desc()).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback_data: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    await rate_limit_feedback(request)
    if feedback_data.website:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback could not be submitted.",
        )

    feedback = Feedback(
        category=feedback_data.category,
        message=feedback_data.message,
        email=str(feedback_data.email) if feedback_data.email else None,
    )
    db.add(feedback)
    db.commit()
    return {"message": "Thanks for helping us improve SmallTown."}
