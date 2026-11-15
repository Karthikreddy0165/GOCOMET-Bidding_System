from celery import Celery
from app.config import settings

celery_app = Celery(
    "british_auction_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "close-overdue-auctions-every-10s": {
            "task": "app.workers.tasks.close_overdue_auctions",
            "schedule": 10.0,
        },
    },
)

