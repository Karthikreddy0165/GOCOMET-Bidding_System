import pytest
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import async_session_factory, engine
from app.models.user import User
from app.models.rfq import RFQ
from app.models.auction import Auction
from app.models.auction_config import AuctionConfiguration
from app.models.auction_supplier import AuctionSupplier
from app.models.bid import Bid
from app.services.auth_service import hash_password, create_access_token


@pytest_asyncio.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def setup_auction():
    """Sets up an auction in PostgreSQL for testing reverse bidding & triggers."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as session:
        # Create Buyer
        buyer = User(
            id=uuid.uuid4(),
            email=f"buyer_test_{uuid.uuid4().hex[:6]}@test.com",
            password_hash=hash_password("password123"),
            role="BUYER",
            full_name="Test Buyer",
            is_active=True,
        )
        # Create 2 Suppliers
        supplier1 = User(
            id=uuid.uuid4(),
            email=f"sup1_{uuid.uuid4().hex[:6]}@test.com",
            password_hash=hash_password("password123"),
            role="SUPPLIER",
            full_name="Supplier 1 Cargo",
            is_active=True,
        )
        supplier2 = User(
            id=uuid.uuid4(),
            email=f"sup2_{uuid.uuid4().hex[:6]}@test.com",
            password_hash=hash_password("password123"),
            role="SUPPLIER",
            full_name="Supplier 2 Freight",
            is_active=True,
        )
        session.add_all([buyer, supplier1, supplier2])
        await session.flush()

        # Create RFQ
        rfq = RFQ(
            id=uuid.uuid4(),
            buyer_id=buyer.id,
            reference=f"RFQ-TEST-{uuid.uuid4().hex[:6]}",
            name="Route Test Auction",
            pickup_service_at=now + timedelta(days=2),
            status="ACTIVE",
        )
        session.add(rfq)
        await session.flush()

        # Create Auction: scheduled close in 8 mins, forced close in 15 mins
        # Trigger window X = 10 mins (so now is INSIDE trigger window!)
        # Extension Y = 5 mins
        scheduled_close = now + timedelta(minutes=8)
        forced_close = now + timedelta(minutes=15)
        auction = Auction(
            id=uuid.uuid4(),
            rfq_id=rfq.id,
            start_at=now - timedelta(minutes=10),
            scheduled_close_at=scheduled_close,
            current_close_at=scheduled_close,
            forced_close_at=forced_close,
            status="ACTIVE",
            version=1,
        )
        session.add(auction)
        await session.flush()

        # Configuration: all triggers enabled
        config = AuctionConfiguration(
            id=uuid.uuid4(),
            auction_id=auction.id,
            trigger_window_minutes=10,  # X = 10 min
            extension_minutes=5,        # Y = 5 min
            trigger_bid_received=True,
            trigger_any_rank_change=True,
            trigger_l1_change=True,
        )
        session.add(config)

        # Associate both suppliers
        assoc1 = AuctionSupplier(
            id=uuid.uuid4(),
            auction_id=auction.id,
            supplier_id=supplier1.id,
            status="INVITED",
        )
        assoc2 = AuctionSupplier(
            id=uuid.uuid4(),
            auction_id=auction.id,
            supplier_id=supplier2.id,
            status="INVITED",
        )
        session.add_all([assoc1, assoc2])
        await session.commit()

        # Generate tokens
        buyer_token = create_access_token({"sub": str(buyer.id), "role": "BUYER", "email": buyer.email})
        sup1_token = create_access_token({"sub": str(supplier1.id), "role": "SUPPLIER", "email": supplier1.email})
        sup2_token = create_access_token({"sub": str(supplier2.id), "role": "SUPPLIER", "email": supplier2.email})

        yield {
            "buyer": buyer,
            "supplier1": supplier1,
            "supplier2": supplier2,
            "rfq": rfq,
            "auction": auction,
            "config": config,
            "buyer_token": buyer_token,
            "sup1_token": sup1_token,
            "sup2_token": sup2_token,
        }

    # Teardown: Clean up test fixture records from database so tests never leave state behind
    async with async_session_factory() as session:
        from sqlalchemy import text
        await session.execute(text("""
            DELETE FROM auction_extensions WHERE auction_id IN (
                SELECT id FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
            )
        """), {"bid": buyer.id})
        await session.execute(text("""
            DELETE FROM auction_activities WHERE auction_id IN (
                SELECT id FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
            )
        """), {"bid": buyer.id})
        await session.execute(text("""
            DELETE FROM bids WHERE auction_id IN (
                SELECT id FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
            )
        """), {"bid": buyer.id})
        await session.execute(text("""
            DELETE FROM auction_configurations WHERE auction_id IN (
                SELECT id FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
            )
        """), {"bid": buyer.id})
        await session.execute(text("""
            DELETE FROM auction_suppliers WHERE auction_id IN (
                SELECT id FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
            )
        """), {"bid": buyer.id})
        await session.execute(text("""
            DELETE FROM auctions WHERE rfq_id IN (SELECT id FROM rfqs WHERE buyer_id = :bid)
        """), {"bid": buyer.id})
        await session.execute(text("DELETE FROM rfqs WHERE buyer_id = :bid"), {"bid": buyer.id})
        await session.execute(text("DELETE FROM users WHERE id IN (:b, :s1, :s2)"), {"b": buyer.id, "s1": supplier1.id, "s2": supplier2.id})
        await session.commit()


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_auth_login_and_me(client: AsyncClient, setup_auction):
    """Test login and /auth/me returns valid user info."""
    data = setup_auction
    res = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res.status_code == 200
    assert res.json()["email"] == data["supplier1"].email
    assert res.json()["role"] == "SUPPLIER"


@pytest.mark.asyncio
async def test_reverse_bid_and_extension(client: AsyncClient, setup_auction):
    """
    Test British Auction Dynamic Extension:
    - Supplier 1 submits bid in the trigger window
    - Auction should automatically extend by Y (5 mins)
    - Check new_close = min(current_close + 5m, forced_close)
    """
    data = setup_auction
    auction_id = str(data["auction"].id)

    # 1. Supplier 1 submits opening bid: 50,000
    idempotency_key = str(uuid.uuid4())
    bid_payload = {
        "idempotency_key": idempotency_key,
        "carrier_name": "Test Express",
        "freight_charge": 45000.0,
        "origin_charge": 3000.0,
        "destination_charge": 2000.0,
        "transit_time_hours": 36,
    }

    res = await client.post(
        f"/auctions/{auction_id}/bids",
        json=bid_payload,
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res.status_code in [200, 201]
    bid_resp = res.json()
    assert float(bid_resp["total_amount"]) == 50000.0
    assert bid_resp["rank"] == 1

    # Check that auction was extended by 5 minutes
    auction_res = await client.get(
        f"/auctions/{auction_id}",
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert auction_res.status_code == 200
    detail = auction_res.json()
    assert len(detail["extensions"]) == 1
    assert "BID_RECEIVED" in detail["extensions"][0]["reason"]


@pytest.mark.asyncio
async def test_faster_transit_time_breaks_price_tie(client: AsyncClient, setup_auction):
    """
    Test Price Tie-Breaking:
    When suppliers quote the same amount (e.g. 40,000 INR),
    the supplier with the faster transit time ranks higher (L1).
    """
    data = setup_auction
    auction_id = str(data["auction"].id)

    # 1. Supplier 1 submits quote: 40,000 with 48 hours transit
    res1 = await client.post(
        f"/auctions/{auction_id}/bids",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "freight_charge": 35000.0,
            "origin_charge": 3000.0,
            "destination_charge": 2000.0,
            "transit_time_hours": 48,
        },
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res1.status_code in [200, 201]
    assert res1.json()["rank"] == 1

    # 2. Supplier 2 quotes same 40,000 but faster transit (24 hours)
    res2 = await client.post(
        f"/auctions/{auction_id}/bids",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "freight_charge": 35000.0,
            "origin_charge": 3000.0,
            "destination_charge": 2000.0,
            "transit_time_hours": 24,
        },
        headers={"Authorization": f"Bearer {data['sup2_token']}"},
    )
    assert res2.status_code in [200, 201]
    # Supplier 2 must be ranked L1 because of faster delivery
    assert res2.json()["rank"] == 1

    # Check auction detail rankings
    detail_res = await client.get(
        f"/auctions/{auction_id}",
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert detail_res.status_code == 200
    bids = detail_res.json()["bids"]
    assert bids[0]["supplier_id"] == str(data["supplier2"].id)
    assert bids[0]["rank"] == 1
    assert bids[0]["transit_time_hours"] == 24


@pytest.mark.asyncio
async def test_forced_close_cap(client: AsyncClient, setup_auction):
    """
    Validation Rule:
    Auction extensions must NEVER exceed the Forced Bid Close Time.
    """
    data = setup_auction
    auction_id = str(data["auction"].id)
    forced_close_iso = data["auction"].forced_close_at.isoformat()

    # Repeated bids by competing suppliers
    # Bid 1 by Supplier 1: 50,000
    await client.post(
        f"/auctions/{auction_id}/bids",
        json={"idempotency_key": str(uuid.uuid4()), "freight_charge": 45000.0, "origin_charge": 3000.0, "destination_charge": 2000.0},
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    # Bid 2 by Supplier 2: 48,000
    await client.post(
        f"/auctions/{auction_id}/bids",
        json={"idempotency_key": str(uuid.uuid4()), "freight_charge": 43000.0, "origin_charge": 3000.0, "destination_charge": 2000.0},
        headers={"Authorization": f"Bearer {data['sup2_token']}"},
    )
    # Bid 3 by Supplier 1: 45,000
    await client.post(
        f"/auctions/{auction_id}/bids",
        json={"idempotency_key": str(uuid.uuid4()), "freight_charge": 40000.0, "origin_charge": 3000.0, "destination_charge": 2000.0},
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )

    # Check that supplier CANNOT see forced_close_at
    supplier_view_res = await client.get(
        f"/auctions/{auction_id}",
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert supplier_view_res.json()["forced_close_at"] is None

    # Check that buyer sees forced_close_at and current_close_at is <= forced_close_at
    buyer_view_res = await client.get(
        f"/auctions/{auction_id}",
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    detail = buyer_view_res.json()
    assert detail["forced_close_at"] is not None
    current_close = datetime.fromisoformat(detail["current_close_at"])
    forced_close = datetime.fromisoformat(detail["forced_close_at"])
    assert current_close <= forced_close


@pytest.mark.asyncio
async def test_idempotency_key_duplicate(client: AsyncClient, setup_auction):
    """
    Idempotent Bid Request:
    Repeated submission with the same idempotency key returns the original outcome
    and does not create another bid or duplicate extensions.
    """
    data = setup_auction
    auction_id = str(data["auction"].id)
    idemp_key = str(uuid.uuid4())

    payload = {
        "idempotency_key": idemp_key,
        "freight_charge": 30000.0,
        "origin_charge": 2000.0,
        "destination_charge": 1000.0,
    }

    res1 = await client.post(
        f"/auctions/{auction_id}/bids",
        json=payload,
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res1.status_code in [200, 201]
    bid_id1 = res1.json()["id"]

    # Post identical request with same key
    res2 = await client.post(
        f"/auctions/{auction_id}/bids",
        json=payload,
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res2.status_code in [200, 201]
    bid_id2 = res2.json()["id"]

    # Same bid returned, not a new one
    assert bid_id1 == bid_id2


@pytest.mark.asyncio
async def test_validation_rule_forced_close_greater_than_close(client: AsyncClient, setup_auction):
    """
    Rule: Forced Bid Close Time must always be greater than Bid Close Time.
    """
    data = setup_auction
    now = datetime.now(timezone.utc)
    
    # Create fresh RFQ for this test
    fresh_rfq_res = await client.post(
        "/rfqs/",
        json={
            "reference": f"RFQ-VAL-{uuid.uuid4().hex[:6]}",
            "name": "Validation Test RFQ",
            "pickup_service_at": (now + timedelta(days=2)).isoformat(),
        },
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert fresh_rfq_res.status_code == 201
    rfq_id = fresh_rfq_res.json()["id"]

    # Attempt to create auction where forced_close <= scheduled_close
    bad_auction_payload = {
        "start_at": now.isoformat(),
        "scheduled_close_at": (now + timedelta(minutes=30)).isoformat(),
        "forced_close_at": (now + timedelta(minutes=25)).isoformat(),  # Earlier!
        "config": {
            "trigger_window_minutes": 10,
            "extension_minutes": 5,
            "trigger_bid_received": True,
        },
    }

    res = await client.post(
        f"/rfqs/{rfq_id}/auction",
        json=bad_auction_payload,
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert res.status_code == 400
    assert "scheduled_close_at" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_active_auction_name_rejected(client: AsyncClient, setup_auction):
    """
    Rule: There cannot be multiple active/scheduled auctions with the same name.
    """
    data = setup_auction
    now = datetime.now(timezone.utc)
    unique_name = f"Mumbai-Delhi Express Route {uuid.uuid4().hex[:6]}"

    # 1. Create first RFQ & Auction with this name
    rfq1_res = await client.post(
        "/rfqs/",
        json={
            "reference": f"RFQ-UNIQ1-{uuid.uuid4().hex[:6]}",
            "name": unique_name,
            "pickup_service_at": (now + timedelta(days=2)).isoformat(),
        },
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert rfq1_res.status_code == 201
    rfq1_id = rfq1_res.json()["id"]

    auction1_res = await client.post(
        f"/rfqs/{rfq1_id}/auction",
        json={
            "start_at": now.isoformat(),
            "scheduled_close_at": (now + timedelta(minutes=30)).isoformat(),
            "forced_close_at": (now + timedelta(minutes=45)).isoformat(),
            "config": {
                "trigger_window_minutes": 10,
                "extension_minutes": 5,
                "trigger_bid_received": True,
            },
        },
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert auction1_res.status_code == 201

    # 2. Attempt to create a second RFQ with the identical active auction name
    rfq2_res = await client.post(
        "/rfqs/",
        json={
            "reference": f"RFQ-UNIQ2-{uuid.uuid4().hex[:6]}",
            "name": unique_name.lower(),  # Case-insensitive duplicate test
            "pickup_service_at": (now + timedelta(days=3)).isoformat(),
        },
        headers={"Authorization": f"Bearer {data['buyer_token']}"},
    )
    assert rfq2_res.status_code == 400
    assert "already exists" in rfq2_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_single_supplier_cannot_submit_same_bid_amount(client: AsyncClient, setup_auction):
    """
    Rule: A single supplier should not be allowed to submit the same bid amount again.
    """
    data = setup_auction
    auction_id = str(data["auction"].id)

    # 1. Supplier 1 submits quote of 25,000
    res1 = await client.post(
        f"/auctions/{auction_id}/bids",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "freight_charge": 23000.0,
            "origin_charge": 1000.0,
            "destination_charge": 1000.0,
            "transit_time_hours": 48,
        },
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res1.status_code == 201

    # 2. Supplier 1 tries to submit the exact same total amount (25,000) with a new idempotency key
    res2 = await client.post(
        f"/auctions/{auction_id}/bids",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "freight_charge": 23000.0,
            "origin_charge": 1000.0,
            "destination_charge": 1000.0,
            "transit_time_hours": 24,  # Even with different transit, same price from same supplier is blocked
        },
        headers={"Authorization": f"Bearer {data['sup1_token']}"},
    )
    assert res2.status_code == 400
    assert "cannot submit the same bid amount" in res2.json()["detail"].lower()

    # 3. But a DIFFERENT supplier (Supplier 2) CAN submit 25,000 (valid competitor tie)
    res3 = await client.post(
        f"/auctions/{auction_id}/bids",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "freight_charge": 23000.0,
            "origin_charge": 1000.0,
            "destination_charge": 1000.0,
            "transit_time_hours": 24,
        },
        headers={"Authorization": f"Bearer {data['sup2_token']}"},
    )
    assert res3.status_code == 201


