import uuid
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging

from sqlalchemy import create_engine, select, delete
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.user import User
from app.models.rfq import RFQ
from app.models.auction import Auction
from app.models.auction_config import AuctionConfiguration
from app.models.auction_supplier import AuctionSupplier
from app.models.bid import Bid
from app.models.activity import AuctionActivity
from app.models.auction_extension import AuctionExtension
from app.services.auth_service import hash_password

logger = logging.getLogger("seed")

engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


DEMO_USERS = [
    # Buyers
    {
        "email": "buyer@gocomet.com",
        "full_name": "GoComet Freight Procurement",
        "role": "BUYER",
    },
    {
        "email": "buyer1@test.com",
        "full_name": "Rajesh Sharma (Apex Logistics)",
        "role": "BUYER",
    },
    {
        "email": "buyer2@test.com",
        "full_name": "Priya Patel (Global Freight Corp)",
        "role": "BUYER",
    },
    # Suppliers
    {
        "email": "maersk@shipping.com",
        "full_name": "A.P. Moller - Maersk",
        "role": "SUPPLIER",
    },
    {
        "email": "hapag@shipping.com",
        "full_name": "Hapag-Lloyd Logistics",
        "role": "SUPPLIER",
    },
    {
        "email": "msc@shipping.com",
        "full_name": "MSC Mediterranean Shipping",
        "role": "SUPPLIER",
    },
    {
        "email": "supplier1@test.com",
        "full_name": "FastTrack Express Logistics",
        "role": "SUPPLIER",
    },
    {
        "email": "supplier2@test.com",
        "full_name": "BlueDart Freight Solutions",
        "role": "SUPPLIER",
    },
    {
        "email": "supplier3@test.com",
        "full_name": "FedEx Supply Chain",
        "role": "SUPPLIER",
    },
]

DEMO_RFQ_REFS = [
    "RFQ-2026-MUM-ROT-01",
    "RFQ-2026-CHN-SIN-02",
    "RFQ-2026-MUN-DXB-03",
    "RFQ-2026-CCU-CTG-04",
    "RFQ-2026-CHN-MUM-01",
]


def seed_database(reset: bool = False):
    """
    Seeds default demo accounts and rich British Reverse Auctions.
    If reset=True, purges previous demo auctions and resets them with fresh countdowns.
    """
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        user_map: dict[str, User] = {}
        created_users = 0

        # 1. Seed or retrieve demo users
        for u_data in DEMO_USERS:
            existing = db.execute(
                select(User).where(User.email == u_data["email"])
            ).scalar_one_or_none()

            if not existing:
                user = User(
                    id=uuid.uuid4(),
                    email=u_data["email"],
                    password_hash=hash_password("password123"),
                    role=u_data["role"],
                    full_name=u_data["full_name"],
                    is_active=True,
                )
                db.add(user)
                db.flush()
                user_map[u_data["email"]] = user
                created_users += 1
            else:
                user_map[u_data["email"]] = existing

        buyer_gocomet = user_map["buyer@gocomet.com"]
        buyer_apex = user_map["buyer1@test.com"]
        maersk = user_map["maersk@shipping.com"]
        hapag = user_map["hapag@shipping.com"]
        msc = user_map["msc@shipping.com"]
        fasttrack = user_map["supplier1@test.com"]
        bluedart = user_map["supplier2@test.com"]
        fedex = user_map["supplier3@test.com"]

        all_suppliers = [maersk, hapag, msc, fasttrack, bluedart, fedex]
        now = datetime.now(timezone.utc)

        # 2. If reset requested, purge existing demo RFQs and child records
        if reset:
            print("Purging existing demo auctions for fresh reset...")
            existing_rfqs = db.execute(
                select(RFQ).where(RFQ.reference.in_(DEMO_RFQ_REFS))
            ).scalars().all()

            rfq_ids = [r.id for r in existing_rfqs]
            if rfq_ids:
                existing_auctions = db.execute(
                    select(Auction).where(Auction.rfq_id.in_(rfq_ids))
                ).scalars().all()
                auction_ids = [a.id for a in existing_auctions]

                if auction_ids:
                    db.execute(delete(AuctionExtension).where(AuctionExtension.auction_id.in_(auction_ids)))
                    db.execute(delete(AuctionActivity).where(AuctionActivity.auction_id.in_(auction_ids)))
                    db.execute(delete(Bid).where(Bid.auction_id.in_(auction_ids)))
                    db.execute(delete(AuctionConfiguration).where(AuctionConfiguration.auction_id.in_(auction_ids)))
                    db.execute(delete(AuctionSupplier).where(AuctionSupplier.auction_id.in_(auction_ids)))
                    db.execute(delete(Auction).where(Auction.id.in_(auction_ids)))

                db.execute(delete(RFQ).where(RFQ.id.in_(rfq_ids)))
                db.commit()
                print("Purged previous demo records.")

        # -------------------------------------------------------------
        # AUCTION 1: Active Main British Auction (Closing in ~45 mins)
        # -------------------------------------------------------------
        rfq1_ref = "RFQ-2026-MUM-ROT-01"
        rfq1 = db.execute(select(RFQ).where(RFQ.reference == rfq1_ref)).scalar_one_or_none()
        if not rfq1:
            rfq1 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer_gocomet.id,
                reference=rfq1_ref,
                name="Nhava Sheva (JNPT) to Rotterdam Port Haulage",
                description="50x 40ft High-Cube Dry Containers. British Reverse Auction with dynamic time extension safeguards. Qualified suppliers bid down landed freight rates.",
                pickup_service_at=now + timedelta(days=7),
                status="ACTIVE",
                created_at=now - timedelta(minutes=20),
                updated_at=now - timedelta(minutes=20),
            )
            db.add(rfq1)
            db.flush()

            scheduled_close = now + timedelta(minutes=45)
            forced_close = now + timedelta(hours=3)
            auction1 = Auction(
                id=uuid.uuid4(),
                rfq_id=rfq1.id,
                start_at=now - timedelta(minutes=20),
                scheduled_close_at=scheduled_close,
                current_close_at=scheduled_close,
                forced_close_at=forced_close,
                status="ACTIVE",
                version=1,
                created_at=now - timedelta(minutes=20),
                updated_at=now - timedelta(minutes=20),
            )
            db.add(auction1)
            db.flush()

            db.add(AuctionConfiguration(
                id=uuid.uuid4(),
                auction_id=auction1.id,
                trigger_window_minutes=10,
                extension_minutes=5,
                trigger_bid_received=True,
                trigger_any_rank_change=True,
                trigger_l1_change=True,
            ))

            for s in all_suppliers:
                db.add(AuctionSupplier(
                    id=uuid.uuid4(),
                    auction_id=auction1.id,
                    supplier_id=s.id,
                    status="INVITED",
                    invited_at=now - timedelta(minutes=20),
                ))

            # 3 Competitive Bids
            b1 = Bid(
                id=uuid.uuid4(),
                auction_id=auction1.id,
                supplier_id=maersk.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="Maersk Triple-E Liner",
                freight_charge=Decimal("45000.00"),
                origin_charge=Decimal("3500.00"),
                destination_charge=Decimal("2500.00"),
                total_amount=Decimal("51000.00"),
                transit_time_hours=48,
                valid_until=now + timedelta(days=14),
                status="ACCEPTED",
                submitted_at=now - timedelta(minutes=15),
            )
            b2 = Bid(
                id=uuid.uuid4(),
                auction_id=auction1.id,
                supplier_id=msc.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="MSC Isabella Express",
                freight_charge=Decimal("43000.00"),
                origin_charge=Decimal("3500.00"),
                destination_charge=Decimal("2500.00"),
                total_amount=Decimal("49000.00"),
                transit_time_hours=46,
                valid_until=now + timedelta(days=14),
                status="ACCEPTED",
                submitted_at=now - timedelta(minutes=10),
            )
            b3 = Bid(
                id=uuid.uuid4(),
                auction_id=auction1.id,
                supplier_id=hapag.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="Hapag-Lloyd Al Jmeliyah",
                freight_charge=Decimal("40000.00"),
                origin_charge=Decimal("3500.00"),
                destination_charge=Decimal("2500.00"),
                total_amount=Decimal("46000.00"),
                transit_time_hours=44,
                valid_until=now + timedelta(days=14),
                status="ACCEPTED",
                submitted_at=now - timedelta(minutes=5),
            )
            db.add_all([b1, b2, b3])

            db.add_all([
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction1.id,
                    actor_user_id=maersk.id,
                    event_type="BID_ACCEPTED",
                    description=f"{maersk.full_name} placed opening quote of ₹51,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "51000.00", "bid_id": str(b1.id)},
                    created_at=now - timedelta(minutes=15),
                ),
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction1.id,
                    actor_user_id=msc.id,
                    event_type="BID_ACCEPTED",
                    description=f"{msc.full_name} placed underbid of ₹49,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "49000.00", "bid_id": str(b2.id)},
                    created_at=now - timedelta(minutes=10),
                ),
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction1.id,
                    actor_user_id=hapag.id,
                    event_type="BID_ACCEPTED",
                    description=f"{hapag.full_name} placed underbid of ₹46,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "46000.00", "bid_id": str(b3.id)},
                    created_at=now - timedelta(minutes=5),
                ),
            ])

        # -------------------------------------------------------------
        # AUCTION 2: Active Auction in Trigger Window (Closing in 7 mins!)
        # Allows instant testing of the dynamic anti-sniping extension rule
        # -------------------------------------------------------------
        rfq2_ref = "RFQ-2026-CHN-SIN-02"
        rfq2 = db.execute(select(RFQ).where(RFQ.reference == rfq2_ref)).scalar_one_or_none()
        if not rfq2:
            rfq2 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer_apex.id,
                reference=rfq2_ref,
                name="Chennai Harbor to Singapore Jurong Island ISO Tanks",
                description="30x 20ft ISO Tank Containers (Chemical Grade). Closes in 7 minutes — submit a quote now to observe dynamic anti-sniping time extension in real-time!",
                pickup_service_at=now + timedelta(days=4),
                status="ACTIVE",
                created_at=now - timedelta(minutes=25),
                updated_at=now - timedelta(minutes=25),
            )
            db.add(rfq2)
            db.flush()

            scheduled_close2 = now + timedelta(minutes=7)
            forced_close2 = now + timedelta(hours=1)
            auction2 = Auction(
                id=uuid.uuid4(),
                rfq_id=rfq2.id,
                start_at=now - timedelta(minutes=25),
                scheduled_close_at=scheduled_close2,
                current_close_at=scheduled_close2,
                forced_close_at=forced_close2,
                status="ACTIVE",
                version=1,
                created_at=now - timedelta(minutes=25),
                updated_at=now - timedelta(minutes=25),
            )
            db.add(auction2)
            db.flush()

            db.add(AuctionConfiguration(
                id=uuid.uuid4(),
                auction_id=auction2.id,
                trigger_window_minutes=10,
                extension_minutes=5,
                trigger_bid_received=True,
                trigger_any_rank_change=True,
                trigger_l1_change=True,
            ))

            for s in all_suppliers:
                db.add(AuctionSupplier(
                    id=uuid.uuid4(),
                    auction_id=auction2.id,
                    supplier_id=s.id,
                    status="INVITED",
                    invited_at=now - timedelta(minutes=25),
                ))

            b_fast = Bid(
                id=uuid.uuid4(),
                auction_id=auction2.id,
                supplier_id=fasttrack.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="FastTrack Coastal 18",
                freight_charge=Decimal("33000.00"),
                origin_charge=Decimal("2500.00"),
                destination_charge=Decimal("2500.00"),
                total_amount=Decimal("38000.00"),
                transit_time_hours=36,
                valid_until=now + timedelta(days=10),
                status="ACCEPTED",
                submitted_at=now - timedelta(minutes=18),
            )
            b_blue = Bid(
                id=uuid.uuid4(),
                auction_id=auction2.id,
                supplier_id=bluedart.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="BlueDart Tanker Vessel",
                freight_charge=Decimal("30500.00"),
                origin_charge=Decimal("2500.00"),
                destination_charge=Decimal("2500.00"),
                total_amount=Decimal("35500.00"),
                transit_time_hours=32,
                valid_until=now + timedelta(days=10),
                status="ACCEPTED",
                submitted_at=now - timedelta(minutes=12),
            )
            db.add_all([b_fast, b_blue])

            db.add_all([
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction2.id,
                    actor_user_id=fasttrack.id,
                    event_type="BID_ACCEPTED",
                    description=f"{fasttrack.full_name} submitted opening quote of ₹38,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "38000.00", "bid_id": str(b_fast.id)},
                    created_at=now - timedelta(minutes=18),
                ),
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction2.id,
                    actor_user_id=bluedart.id,
                    event_type="BID_ACCEPTED",
                    description=f"{bluedart.full_name} submitted underbid of ₹35,500.00 (Rank: L1)",
                    metadata_json={"total_amount": "35500.00", "bid_id": str(b_blue.id)},
                    created_at=now - timedelta(minutes=12),
                ),
            ])

        # -------------------------------------------------------------
        # AUCTION 3: Scheduled Upcoming Auction (Starts Tomorrow)
        # -------------------------------------------------------------
        rfq3_ref = "RFQ-2026-MUN-DXB-03"
        rfq3 = db.execute(select(RFQ).where(RFQ.reference == rfq3_ref)).scalar_one_or_none()
        if not rfq3:
            rfq3 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer_gocomet.id,
                reference=rfq3_ref,
                name="Mundra Port to Jebel Ali (Dubai) Reefer Haulage",
                description="100x 40ft refrigerated containers (-20°C pharma grade cold chain). Bidding opens tomorrow.",
                pickup_service_at=now + timedelta(days=10),
                status="SCHEDULED",
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(hours=2),
            )
            db.add(rfq3)
            db.flush()

            start_tomorrow = now + timedelta(days=1)
            scheduled_close3 = start_tomorrow + timedelta(hours=6)
            forced_close3 = start_tomorrow + timedelta(hours=24)
            auction3 = Auction(
                id=uuid.uuid4(),
                rfq_id=rfq3.id,
                start_at=start_tomorrow,
                scheduled_close_at=scheduled_close3,
                current_close_at=scheduled_close3,
                forced_close_at=forced_close3,
                status="SCHEDULED",
                version=1,
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(hours=2),
            )
            db.add(auction3)
            db.flush()

            db.add(AuctionConfiguration(
                id=uuid.uuid4(),
                auction_id=auction3.id,
                trigger_window_minutes=15,
                extension_minutes=10,
                trigger_bid_received=True,
                trigger_any_rank_change=True,
                trigger_l1_change=True,
            ))

            for s in [maersk, hapag, msc, fedex]:
                db.add(AuctionSupplier(
                    id=uuid.uuid4(),
                    auction_id=auction3.id,
                    supplier_id=s.id,
                    status="INVITED",
                    invited_at=now - timedelta(hours=2),
                ))

        # -------------------------------------------------------------
        # AUCTION 4: Completed / Closed Historical Auction
        # -------------------------------------------------------------
        rfq4_ref = "RFQ-2026-CCU-CTG-04"
        rfq4 = db.execute(select(RFQ).where(RFQ.reference == rfq4_ref)).scalar_one_or_none()
        if not rfq4:
            rfq4 = RFQ(
                id=uuid.uuid4(),
                buyer_id=buyer_gocomet.id,
                reference=rfq4_ref,
                name="Kolkata Haldia to Chittagong Coastal Barge Freight",
                description="25x 20ft standard dry containers. Historical completed British reverse auction.",
                pickup_service_at=now + timedelta(days=2),
                status="COMPLETED",
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=1),
            )
            db.add(rfq4)
            db.flush()

            start_past = now - timedelta(days=2)
            closed_past = now - timedelta(days=1)
            auction4 = Auction(
                id=uuid.uuid4(),
                rfq_id=rfq4.id,
                start_at=start_past,
                scheduled_close_at=closed_past,
                current_close_at=closed_past,
                forced_close_at=closed_past + timedelta(hours=2),
                status="CLOSED",
                version=2,
                created_at=start_past,
                updated_at=closed_past,
            )
            db.add(auction4)
            db.flush()

            db.add(AuctionConfiguration(
                id=uuid.uuid4(),
                auction_id=auction4.id,
                trigger_window_minutes=10,
                extension_minutes=5,
                trigger_bid_received=True,
                trigger_any_rank_change=True,
                trigger_l1_change=True,
            ))

            for s in [maersk, fasttrack, bluedart]:
                db.add(AuctionSupplier(
                    id=uuid.uuid4(),
                    auction_id=auction4.id,
                    supplier_id=s.id,
                    status="INVITED",
                    invited_at=start_past,
                ))

            b_hist1 = Bid(
                id=uuid.uuid4(),
                auction_id=auction4.id,
                supplier_id=fasttrack.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="FastTrack Feeder #09",
                freight_charge=Decimal("26000.00"),
                origin_charge=Decimal("2000.00"),
                destination_charge=Decimal("2000.00"),
                total_amount=Decimal("30000.00"),
                transit_time_hours=28,
                valid_until=now + timedelta(days=7),
                status="ACCEPTED",
                submitted_at=start_past + timedelta(hours=3),
            )
            b_hist2 = Bid(
                id=uuid.uuid4(),
                auction_id=auction4.id,
                supplier_id=maersk.id,
                idempotency_key=uuid.uuid4(),
                carrier_name="Maersk Coastal Shuttle",
                freight_charge=Decimal("24000.00"),
                origin_charge=Decimal("2000.00"),
                destination_charge=Decimal("2000.00"),
                total_amount=Decimal("28000.00"),
                transit_time_hours=24,
                valid_until=now + timedelta(days=7),
                status="ACCEPTED",
                submitted_at=start_past + timedelta(hours=5),
            )
            db.add_all([b_hist1, b_hist2])

            db.add_all([
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction4.id,
                    actor_user_id=fasttrack.id,
                    event_type="BID_ACCEPTED",
                    description=f"{fasttrack.full_name} submitted opening quote of ₹30,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "30000.00", "bid_id": str(b_hist1.id)},
                    created_at=start_past + timedelta(hours=3),
                ),
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction4.id,
                    actor_user_id=maersk.id,
                    event_type="BID_ACCEPTED",
                    description=f"{maersk.full_name} submitted winning underbid of ₹28,000.00 (Rank: L1)",
                    metadata_json={"total_amount": "28000.00", "bid_id": str(b_hist2.id)},
                    created_at=start_past + timedelta(hours=5),
                ),
                AuctionActivity(
                    id=uuid.uuid4(),
                    auction_id=auction4.id,
                    actor_user_id=None,
                    event_type="AUCTION_CLOSED",
                    description=f"Auction concluded. Winning supplier: {maersk.full_name} with L1 quote of ₹28,000.00",
                    metadata_json={"winning_supplier": maersk.full_name, "winning_amount": "28000.00"},
                    created_at=closed_past,
                ),
            ])

        db.commit()
        print("Database seeding completed successfully with 4 sample logistics auctions and demo users!")


if __name__ == "__main__":
    do_reset = "--reset" in sys.argv
    seed_database(reset=do_reset)
