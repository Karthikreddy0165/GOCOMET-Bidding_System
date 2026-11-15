import asyncio
from fastapi import APIRouter
from seed import seed_database

router = APIRouter(prefix="/demo", tags=["Demo Data"])


@router.post("/reset")
async def reset_demo_data():
    """
    Resets demonstration auctions, bids, and activities with fresh countdowns.
    Useful for demonstration and live evaluations.
    """
    await asyncio.to_thread(seed_database, reset=True)
    return {
        "status": "success",
        "message": "Demo data successfully reset. 4 logistics auctions loaded with live bids.",
    }
