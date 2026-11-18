-- Official contest prize settings.
-- These are public display settings only; no winner or payment information is stored here.
INSERT INTO public.settings (key, value, description)
VALUES
    (
        'per_puzzle_prize_usd',
        '1000',
        'Prize amount in USD for each verified book-buyer puzzle winner'
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
    )
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
