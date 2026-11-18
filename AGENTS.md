# Project rules

## Product

This is a Sudoku book contest website.

- Buyers sign up with Google sign-in as the primary option and email plus password as the secondary option. They upload proof of purchase, then submit solutions one puzzle at a time using a photo and a typed grid.
- Puzzles show the printed given digits as locked. Users may type only digits 1 through 9 into empty cells.
- The site checks that each submitted grid follows Sudoku rules and tells the user when it is invalid.
- Users may submit solutions while purchase proof is pending. An admin verifies proof later. Rejected proof may be re-uploaded, and the user receives an email explaining what proof to provide.
- Free players are eligible only for the grand prize. The $1,000 per-puzzle prizes are for verified book buyers; the grand prize is $1 billion.
- The admin panel is on a hard-to-guess URL. Its login uses OTP by mobile and email, and admin details belong only in `.env` or environment variables.
- Apply rate limiting on both backend and frontend, and accept only the data needed for each operation.
- Admins can see every submission. The owner uploads official solutions and declares results later.

## Delivery process

- Work on one small feature at a time.
- Stop after each completed feature for the owner's review before starting the next one.
- Do not change unrelated files or features.
- Never commit secrets or expose `.env` values.
