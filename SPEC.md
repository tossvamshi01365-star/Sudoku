# SPEC.md: Sudoku Contest Website

## 1. Project overview
This is a website for a Sudoku book contest. The owner (the person giving you instructions) published the book "Be Smart, Be a Millionaire: The Sudoku Challenge," which contains 100 puzzles. Readers solve the puzzles and submit their solutions on this website. The owner verifies the submissions and declares the winners.

The brand name and domain are NOT final. Use the placeholder `BRAND_NAME` and `DOMAIN` everywhere. Keep them, together with all prize amounts, in one single settings file or settings table, so that changing the name later means editing one value only. Never write the brand name directly inside pages or text.

The owner is a solo founder and not an expert in this tech stack. The site must be simple, secure and cheap to run.

## 2. Users
- **Book buyer**: bought the book from an official platform. Can win the per-puzzle prize ($1,000 per puzzle) and the $1 billion grand prize.
- **Free player**: did not buy the book. Can play for the grand prize only. One account per person (no duplicate accounts), but can submit solutions to all puzzles that are open to free players. Not eligible for per-puzzle prizes.
- **Admin**: the owner (the person giving you instructions). Full access to everything.

## 3. User flow
1. **Landing page**: explains the contest and shows the buy link for the visitor's country (Amazon, Flipkart, etc.). Also shows a "Play free" option.
2. **Sign up / log in**: email and password. Email verification is required. The user chooses book buyer or free player. Password reset is supported.
3. **Proof of purchase (book buyers)**: the user submits the following proof items (the list of accepted proof items is editable in settings):
   - The Amazon order ID (or equivalent order ID from other platforms). Duplicate order IDs across different accounts are automatically rejected.
   - A screenshot of the order confirmation or invoice (JPG, PNG, or PDF, max 5 MB).
   - A photo of the physical book next to a piece of paper showing the user's username on the site (JPG or PNG, max 5 MB).
   The user can submit puzzle solutions while the proof is still pending review. The admin verifies the proof later and can reject it with a reason. If rejected, the user receives an email explaining the reason and what proof to re-upload, and can then upload a new proof.
4. **Submit solutions**: one puzzle at a time (puzzle 1 to 100). The website shows each puzzle exactly as printed in the book, with the given digits prefilled and locked. The player types digits 1–9 only into the empty cells. All empty cells must be filled before submitting. Book buyers also upload a photo (JPG or PNG, compressed to ~1 MB on the client, max 5 MB server limit) of the finished puzzle in the book. Free players submit the typed solution only (no photo required). When submitted, the system verifies that the solution obeys valid Sudoku rules (1–9 without duplicates in every row, column, and 3×3 box, with original given digits unchanged). If invalid, it shows "Your solution does not follow Sudoku rules" and saves nothing so the user can fix it. If valid, it saves the submission as final and shows "Your solution follows Sudoku rules and has been saved. Results will be announced later." The site never reveals whether the solution matches the author's official solution.
5. **Dashboard**: shows which puzzles are submitted, the proof status (pending, verified, rejected), and lets the user view their own submissions.

## 4. Submission rules
- The puzzle grid shows the given (prefilled) digits locked. The player fills only the empty cells.
- Each cell accepts only a single digit from 1 to 9.
- All empty cells must be filled before the submit button is enabled.
- **Sudoku rules verification**: When submitted, the server validates that the grid obeys standard Sudoku rules: each row, column, and 3×3 box contains digits 1–9 exactly once, and all prefilled/given digits remain unchanged. The browser displays this same rule validation live for user convenience, but the server is the true authority.
  - If invalid: display *"Your solution does not follow Sudoku rules"* and save nothing, allowing the user to correct errors and try again.
  - If valid: save the submission as final and display *"Your solution follows Sudoku rules and has been saved. Results will be announced later."*
  - The system **never** reveals to the user whether their solution matches the admin's official solution.
- One submission per puzzle per user, always. Submissions are final — no edits or resubmission. Only the admin can unlock a submission for resubmission (which archives the old record to submission history and deletes the active record so the user can submit again).
- Every submission is saved with a timestamp.
- The number of puzzles open to free players is an editable setting (see section 9).

## 5. Admin panel

The admin panel is a **separate deployment** hosted on its own hard-to-guess URL. It is never linked from the public site. Admin credentials (email, mobile number, password hash) and all secret keys are stored only in `.env` or environment variables and are never committed to source control.

**Admin login** requires:
1. A strong password.
2. An OTP sent to the admin's email.
3. An OTP sent to the admin's mobile number (designed so that email OTP works first and mobile OTP support can be added later without restructuring).

### Admin panel sections
- **User management**: list of all users, with type (book buyer or free player), proof status, and email.
- **Proof review**: view all uploaded proof items (order ID, order screenshot, book photo). Mark the proof verified or rejected. When rejecting, the admin enters a reason and a note on what the user should re-upload. The system sends a rejection email to the user with this information. If rejected, the user's submissions remain saved but are marked ineligible for per-puzzle prizes until a valid proof is uploaded. The user can upload a new proof after rejection. Grand prize eligibility is not affected by proof status. Duplicate Amazon order IDs across different accounts are flagged automatically.
- **Puzzle setup**: a section where the admin enters the given (prefilled) digits for all 100 puzzles. These are the digits that appear locked on the player's grid.
- **Submission review**: view every submission (photo and typed grid), with filters by puzzle number and by user. Shows user type, proof status, and submission timestamp.
- **Unlock submission**: the admin can unlock a specific submission for a specific user, allowing that user to resubmit their solution for that puzzle. The old submission is kept in history.
- **Official solutions (hidden)**: a section where the admin uploads the official correct solution for each puzzle. These are stored with strict database security and are never visible to any user. The admin can upload solutions at any time (before or after submissions come in).
- **Declare results**: when the admin presses "Declare results," the system compares all submissions against the official solutions and lists the winners for each puzzle and for the grand prize. The results are shown to the admin only. Users do not see any results until the admin presses a separate "Publish results" action to make them visible on the public site.
- **CSV export**: export all submissions as CSV, including user type and proof status columns.
- **Pause switch**: one switch to pause the whole contest (see section 6).

## 6. Rules the system must enforce
- One account per person. Enforced via email verification and rate limiting on sign-ups.
- **Validation on both frontend and backend.** The backend is the real enforcement. Accept only the expected fields and file types. Verify file types on the server (do not trust the client). The frontend validates for user convenience only.
- **Rate limiting** on sign-ups, logins, OTP requests, and file uploads — per user and per IP. Enforced on the backend.
- Users can see only their own data. Only the admin sees everything.
- Contest scope: the free grand-prize game is open to every country. The book and the per-puzzle prizes apply only in the countries where the book is sold. Prizes are paid in the winner's own country.
- Do not collect bank details on the site. They are asked only after someone wins, outside the platform.
- Age: Anyone can play. Prizes are only for winners aged 18 or older, and age is verified when a prize is claimed. This goes in the Official Rules. An optional 18+ sign-up confirmation checkbox can be enabled in settings (`age_check_required`, default: false).
- Pause switch: if there is a hack or cyber threat, the owner can pause the contest, fix the problem, and resume it.
- Upload limits: JPG and PNG only for puzzle photos, max 5 MB each. JPG, PNG, or PDF for proof of purchase, max 5 MB each. File types are verified on the server.
- **Proof rejection**: if a book buyer's proof is rejected, the user receives an email with the rejection reason and instructions on what to re-upload. Their submissions stay saved but are marked ineligible for per-puzzle prizes until valid proof is uploaded. The user can upload a new proof. Grand prize eligibility stays.
- **Duplicate order IDs**: the system rejects any proof submission that uses an Amazon order ID (or other platform order ID) already linked to a different account.

## 7. Pages needed
Landing page, Sign up and Log in, Password reset, Dashboard, Submit solution page, Admin panel, Official Rules, Terms of Use, Privacy Policy, FAQ. The owner will provide the text for Official Rules and FAQ.

## 8. Tech stack
- Next.js (website and admin panel — two separate deployments)
- Supabase (login, database, file storage for photos and proofs)
- Vercel (hosting for both the public site and the admin panel, on separate URLs)
- The project stays in a local folder first and is pushed to GitHub later. Never commit secret keys (the .env file). Admin credentials and all secrets are kept only in `.env` or environment variables.
- The admin deployment uses the Supabase **service role key** (full database access). The public site uses only the Supabase **anon key** and must never have the service role key.

## 9. Open decisions (make these editable settings, do not guess)
- Brand name and domain
- Final grand prize amount (currently a placeholder)
- Accepted proof of purchase items (currently: order ID, order screenshot, book photo with username)
- Accepted file types for proof (currently: JPG, PNG, PDF) and for puzzle photos (currently: JPG, PNG)
- Whether free players get all 100 puzzles or a smaller set
- Submission deadline
- How winners are contacted, and the claim period
- Whether the 18+ age checkbox is required (currently: false - anyone can play, age is verified when claiming prizes)
- Winner rule per puzzle and for the grand prize, to be decided by the owner

## 10. Working instructions for the AI coding tool
- Build in small steps, one feature at a time. Do not build everything at once.
- After each step, explain in simple words what you did and how to test it.
- Do not change files or features outside the current task.
- If anything in this spec is unclear or missing, ask before assuming.
- Keep the code simple and well commented.
- Suggested build order: (1) project setup and database tables, (2) sign up and login, (3) landing page, (4) proof upload, (5) the puzzle grid and photo upload, (6) dashboard, (7) admin panel, (8) legal pages and final checks.
