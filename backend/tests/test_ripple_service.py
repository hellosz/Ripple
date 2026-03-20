from datetime import datetime, timezone
from uuid import uuid4

from app.services.ripple_service import (
    compute_ripple_availability,
    filter_logged_in_recipient_ids,
    is_guest_delivery_claimable,
)


def test_ripple_requires_copy_and_like_before_it_becomes_available():
    now = datetime.now(timezone.utc)
    assert compute_ripple_availability(now, now, None) is True
    assert compute_ripple_availability(None, now, None) is False
    assert compute_ripple_availability(now, None, None) is False
    assert compute_ripple_availability(now, now, now) is False


def test_ripple_recipient_filtering_excludes_sender_and_prior_likers():
    sender_id = uuid4()
    liked_user_id = uuid4()
    eligible_user_id = uuid4()

    filtered = filter_logged_in_recipient_ids(
        [sender_id, liked_user_id, eligible_user_id],
        {liked_user_id},
        sender_id,
    )

    assert filtered == [eligible_user_id]


def test_guest_delivery_only_claims_for_users_who_still_have_not_liked():
    assert is_guest_delivery_claimable(False, False) is True
    assert is_guest_delivery_claimable(True, False) is False
    assert is_guest_delivery_claimable(False, True) is False
