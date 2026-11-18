-- ==============================================================================
-- seed.sql: Public-Safe Initial Settings
-- Admin credentials, secrets, and phone numbers are NEVER stored in this table.
-- ==============================================================================

INSERT INTO public.settings (key, value, description)
VALUES
    (
        'brand_name',
        '"Vamshi Finance"',
        'Official display name of the contest website'
    ),
    (
        'domain',
        '"DOMAIN"',
        'Primary domain of the website'
    ),
    (
        'per_puzzle_prize_usd',
        '1000',
        'Prize amount in USD for each puzzle verified winner (book buyers only)'
    ),
    (
        'grand_prize_amount_usd',
        '1000000000',
        'Official grand prize amount in USD'
    ),
    (
        'grand_prize_is_placeholder',
        'false',
        'Controls whether the public site displays the grand prize as to be announced'
    ),
    (
        'free_puzzles_count',
        '5',
        'Number of puzzles open for free players (e.g. puzzles 1 to 5)'
    ),
    (
        'contest_paused',
        'false',
        'Global kill-switch to pause submissions and new signups during security maintenance'
    ),
    (
        'submission_deadline',
        '"2027-12-31T23:59:59Z"',
        'ISO-8601 UTC deadline for submitting solutions'
    ),
    (
        'age_check_required',
        'false',
        'Whether the 18+ confirmation checkbox is required at sign-up (default: false - anyone can play, age verified at prize claim)'
    ),
    (
        'accepted_proof_items',
        '["order_id", "order_screenshot", "book_photo_with_username"]',
        'List of proof items required from book buyers'
    ),
    (
        'accepted_proof_file_types',
        '["image/jpeg", "image/png", "application/pdf"]',
        'MIME types permitted for proof of purchase upload'
    ),
    (
        'accepted_puzzle_file_types',
        '["image/jpeg", "image/png"]',
        'MIME types permitted for book photo of completed puzzle'
    ),
    (
        'buy_links',
        '{"US": "https://www.amazon.com", "IN": "https://www.amazon.in", "UK": "https://www.amazon.co.uk", "GLOBAL": "https://www.amazon.com"}',
        'Official bookstore purchase links keyed by country code'
    )
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

