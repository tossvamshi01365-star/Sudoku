import Link from 'next/link';
import { headers } from 'next/headers';
import { getBrandName, getSetting } from '../lib/settings';

type BuyLinks = Record<string, unknown>;

/** Title of the printed book. Change it here if the title changes. */
const BOOK_TITLE = 'Be Smart, Be a Millionaire: The Sudoku Challenge';
const TOTAL_PUZZLES = 100;

const formatUsd = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

function getVisitorCountry(): string | null {
  const requestHeaders = headers();
  const country = requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || requestHeaders.get('x-country-code');
  return country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null;
}

function getSafeBuyLink(buyLinks: BuyLinks, visitorCountry: string | null): string | null {
  const countryKey = visitorCountry === 'GB' ? 'UK' : visitorCountry;
  const candidate = countryKey ? buyLinks[countryKey] ?? buyLinks.GLOBAL : buyLinks.GLOBAL;
  if (typeof candidate !== 'string') return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [brandName, contestPaused, buyLinks, grandPrizeAmount, grandPrizeIsPlaceholder, perPuzzlePrize, freePuzzlesCount] = await Promise.all([
    getBrandName(),
    getSetting<boolean>('contest_paused', false),
    getSetting<BuyLinks>('buy_links', {}),
    getSetting<number>('grand_prize_amount_usd', 0),
    getSetting<boolean>('grand_prize_is_placeholder', true),
    getSetting<number>('per_puzzle_prize_usd', 0),
    getSetting<number>('free_puzzles_count', 0),
  ]);
  const buyLink = getSafeBuyLink(buyLinks, getVisitorCountry());
  const grandPrizeKnown = !grandPrizeIsPlaceholder && Number.isFinite(grandPrizeAmount) && grandPrizeAmount > 0;
  const grandPrizeMessage = grandPrizeKnown ? `Grand prize: ${formatUsd(grandPrizeAmount)}.` : 'Grand prize amount to be announced.';
  const grandPrizeLabel = grandPrizeKnown ? formatUsd(grandPrizeAmount) : 'To be announced';
  const perPuzzleLabel = Number.isFinite(perPuzzlePrize) && perPuzzlePrize > 0 ? formatUsd(perPuzzlePrize) : 'To be announced';
  const freeCount = Number.isInteger(freePuzzlesCount) && freePuzzlesCount > 0 ? Math.min(freePuzzlesCount, TOTAL_PUZZLES) : 0;
  const freePuzzlesLabel =
    freeCount === TOTAL_PUZZLES ? `All ${TOTAL_PUZZLES} puzzles` : freeCount > 0 ? `Puzzles 1 to ${freeCount}` : 'Selected puzzles';

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_15%,rgba(79,70,229,0.45),transparent_31%),radial-gradient(circle_at_86%_4%,rgba(245,158,11,0.22),transparent_25%),linear-gradient(135deg,#020617_0%,#111827_52%,#172554_100%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10" aria-label="Main navigation">
          <Link href="/" className="text-base font-bold tracking-tight text-white sm:text-lg">{brandName}</Link>
          <div className="flex items-center gap-4 md:gap-8">
            <a href="#book" className="hidden text-sm font-medium text-slate-300 transition hover:text-white md:inline">The book</a>
            <a href="#prizes" className="hidden text-sm font-medium text-slate-300 transition hover:text-white md:inline">Prizes</a>
            <a href="#how-it-works" className="hidden text-sm font-medium text-slate-300 transition hover:text-white md:inline">How it works</a>
            <Link href="/login" className="text-sm font-medium text-slate-200 transition hover:text-white">Log in</Link>
            <Link href="/signup" className="btn-light rounded-full border border-white/15 px-4 py-2 text-sm font-semibold shadow-lg shadow-slate-950/20 transition">Join the challenge</Link>
          </div>
        </nav>

        {contestPaused && (
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
            <div role="status" className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"><span className="font-semibold">Submissions are paused.</span> We are temporarily carrying out contest maintenance.</div>
          </div>
        )}

        <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:pb-28">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> The Billion-Dollar Sudoku Challenge</p>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">Solve 100 puzzles. <span className="text-amber-300">Could you win $1 billion?</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">One hundred puzzles. One extraordinary finish. Solve every challenge, submit your work, and put yourself in contention for a life-changing billion-dollar grand prize.</p>
            <p className="mt-4 text-sm font-semibold text-amber-200">{grandPrizeMessage}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex min-h-12 items-center justify-center btn-cta rounded-xl px-5 py-3 text-sm font-bold shadow-lg shadow-amber-500/20 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950">Play the challenge</Link>
              {buyLink && <a href={buyLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center btn-outline-light rounded-xl border px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950">Buy the book</a>}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">Book buyers may qualify for $1,000 per-puzzle prizes and the $1 billion grand prize. Free players may enter for the grand prize.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md [perspective:1200px] lg:max-w-none" aria-hidden="true">
            <div className="absolute -inset-6 rounded-[2rem] bg-indigo-500/20 blur-3xl" />
            <div className="hero-orbit absolute -right-2 -top-8 rounded-full border border-amber-200/30 bg-amber-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-100 shadow-lg shadow-amber-950/40">$1B grand prize</div>
            <div className="hero-cube relative rounded-[1.75rem] border border-white/15 bg-slate-900/75 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Your next move</p><p className="mt-1 text-lg font-bold text-white">Puzzle 01</p></div><div className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-slate-950">9 × 9</div></div>
              <div className="grid grid-cols-9 overflow-hidden rounded-xl border-2 border-slate-200/80 bg-slate-100 text-center text-sm font-bold text-slate-800 shadow-inner sm:text-base">
                {[5, '', '', '', 7, '', '', '', 2, '', 9, '', 1, '', '', 8, '', '', '', '', 3, '', '', 5, '', 6, '', 8, '', '', 7, '', '', '', '', 4, '', 6, '', '', 4, '', '', 1, '', 7, '', '', '', 2, '', '', '', 9, '', 3, '', 6, '', '', 8, '', '', '', 1, '', '', '', '', 9, '', 4, '', '', '', 6, '', '', 2, '', '', '', 5].map((digit, index) => {
                  const row = Math.floor(index / 9); const column = index % 9;
                  return <div key={index} className={`aspect-square border border-slate-300/80 p-1 sm:p-2 ${(column === 2 || column === 5) ? 'border-r-2 border-r-slate-700' : ''} ${(row === 2 || row === 5) ? 'border-b-2 border-b-slate-700' : ''} ${digit ? 'bg-slate-200 text-slate-950' : 'bg-white text-indigo-600'}`}>{digit || (index === 12 || index === 40 || index === 68 ? <span className="text-indigo-500">•</span> : '')}</div>;
                })}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><span className="text-slate-300">100 puzzles. One shot.</span><span className="font-semibold text-amber-200">Make it count.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-6 bg-white py-16 text-slate-900 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">A clear path to play</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Bring your best thinking to every grid.</h2></div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">{[['01', 'Create your account', 'Sign up with Google or email, then choose how you would like to participate.'], ['02', 'Take on all 100 puzzles', 'Enter each solution carefully. Given digits stay locked so every grid starts fair.'], ['03', 'Submit with confidence', 'Your completed grid is checked against Sudoku rules before it is saved.']].map(([number, title, description]) => <li key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><span className="text-sm font-black text-indigo-600">{number}</span><h3 className="mt-6 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></li>)}</ol>
        </div>
      </section>

      {/* ---------------- The book ---------------- */}
      <section id="book" className="scroll-mt-6 bg-slate-950 py-16 text-white sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16 lg:px-10">
          {/* Decorative book cover drawn with CSS (no image needed). */}
          <div className="mx-auto w-full max-w-[17rem] [perspective:1200px]" aria-hidden="true">
            <div className="relative aspect-[3/4] rounded-r-2xl rounded-l-md border border-white/10 bg-[linear-gradient(160deg,#1e1b4b_0%,#312e81_45%,#0f172a_100%)] p-6 shadow-2xl shadow-indigo-950/60 [transform:rotateY(-14deg)]">
              <div className="absolute inset-y-0 left-0 w-3 rounded-l-md bg-black/30" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">{TOTAL_PUZZLES} puzzles</p>
              <p className="mt-4 text-2xl font-black leading-tight text-white">Be Smart,<br />Be a Millionaire</p>
              <p className="mt-2 text-sm font-semibold text-amber-300">The Sudoku Challenge</p>
              <div className="absolute inset-x-6 bottom-6 grid grid-cols-3 gap-1 opacity-80">
                {[4, '', 9, '', 1, '', 7, '', 3].map((digit, index) => (
                  <div key={index} className="flex aspect-square items-center justify-center rounded-sm bg-white/10 text-xs font-bold text-white/90">
                    {digit}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">The book</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{BOOK_TITLE}</h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              A printed collection of {TOTAL_PUZZLES} Sudoku puzzles, and your entry ticket to the full contest.
              Solve the puzzles in the book, then submit each solution here to compete for the prizes.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                [`${TOTAL_PUZZLES} puzzles`, 'Every puzzle on this site appears exactly as it is printed in the book.'],
                ['Solve on paper', 'Work through each grid in the book, then type your finished solution online.'],
                ['Prove it is yours', 'Book buyers upload a photo of each finished puzzle in their copy of the book.'],
                ['Every prize in reach', `Verified book buyers can win ${perPuzzleLabel} per puzzle and the grand prize.`],
              ].map(([title, text]) => (
                <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                </li>
              ))}
            </ul>
            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cta mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold shadow-lg shadow-amber-500/20 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Buy the book
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Prizes and ways to play ---------------- */}
      <section id="prizes" className="scroll-mt-6 bg-white py-16 text-slate-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Prizes</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Two ways to win. Two ways to play.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Everyone can play for the grand prize. Buying the book also opens up a prize for every single puzzle.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-950 p-7 text-white shadow-lg">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Grand prize</p>
              <p className="mt-3 text-4xl font-black text-amber-300 sm:text-5xl">{grandPrizeLabel}</p>
              <p className="mt-4 text-sm leading-6 text-slate-300">Open to every player: book buyers and free players.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Per-puzzle prize</p>
              <p className="mt-3 text-4xl font-black text-slate-950 sm:text-5xl">{perPuzzleLabel}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">For each puzzle, for verified book buyers.</p>
            </div>
          </div>

          {/* Side-by-side comparison of the two player types. */}
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {[
              {
                name: 'Book buyer',
                highlight: true,
                rows: [
                  ['Puzzles', `All ${TOTAL_PUZZLES} puzzles`],
                  ['What you submit', 'Your typed grid plus a photo of the finished puzzle in your book'],
                  ['Proof of purchase', 'Order ID, order screenshot, and a photo of the book with your username'],
                  ['Prizes', `${perPuzzleLabel} per puzzle + the grand prize`],
                ],
              },
              {
                name: 'Free player',
                highlight: false,
                rows: [
                  ['Puzzles', freePuzzlesLabel],
                  ['What you submit', 'Your typed grid only, no photo needed'],
                  ['Proof of purchase', 'Not needed'],
                  ['Prizes', 'The grand prize'],
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 ${plan.highlight ? 'border-2 border-indigo-600 bg-white shadow-lg' : 'border border-slate-200 bg-white shadow-sm'}`}
              >
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <dl className="mt-5 divide-y divide-slate-100">
                  {plan.rows.map(([label, value]) => (
                    <div key={label} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
                      <dd className="text-sm leading-6 text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-2 text-sm leading-6 text-slate-500">
            <li>You can submit solutions while your proof of purchase is still being reviewed.</li>
            <li>The free grand-prize game is open in every country. The book and per-puzzle prizes apply in the countries where the book is sold.</li>
            <li>Anyone can play. Prizes are paid to winners aged 18 or older, and age is checked when a prize is claimed.</li>
            <li>We never ask for bank details on this site. They are requested only from winners, outside the platform.</li>
          </ul>
        </div>
      </section>

      {/* ---------------- What happens after you submit ---------------- */}
      <section className="bg-slate-50 py-16 text-slate-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">After you submit</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One puzzle at a time. One final answer each.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              [
                'Checked instantly',
                'Your grid is checked against Sudoku rules: digits 1 to 9 exactly once in every row, column and 3×3 box, with the printed digits unchanged. If something is wrong, nothing is saved and you can fix it.',
              ],
              [
                'Saved as final',
                'A valid solution is saved with a timestamp. You get one submission per puzzle, and it cannot be edited afterwards, so take your time.',
              ],
              [
                'Results announced later',
                'We never reveal whether a solution matches the official answer before the results. Winners are announced once the contest results are published.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-100 py-16 text-slate-900 sm:py-20"><div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Built for fair play</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Your work stays yours.</h2></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="font-bold">Book buyers</h3><p className="mt-2 text-sm leading-6 text-slate-600">Upload proof of purchase for review. You can still submit puzzle solutions while it is pending.</p></div><div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><h3 className="font-bold">Free players</h3><p className="mt-2 text-sm leading-6 text-slate-600">Join the challenge without buying the book and enter for the grand prize.</p></div></div></div></section>

      {/* ---------------- Final call to action ---------------- */}
      <section className="relative isolate bg-slate-950 py-16 text-white sm:py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.35),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(245,158,11,0.18),transparent_35%)]" />
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready for puzzle 1?</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Create your free account with Google or email, and start solving.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="btn-cta inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-sm font-bold shadow-lg shadow-amber-500/20 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Play the challenge
            </Link>
            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-light inline-flex min-h-12 items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Buy the book
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-white/10 bg-slate-950 text-sm text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
          <div>
            <Link href="/" className="text-base font-bold tracking-tight text-white">{brandName}</Link>
            <p className="mt-3 max-w-xs leading-6">
              The Sudoku contest for readers of <span className="text-slate-300">{BOOK_TITLE}</span>. Solve {TOTAL_PUZZLES} puzzles and play for the grand prize.
            </p>
            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-light mt-5 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold transition"
              >
                Buy the book
              </a>
            )}
          </div>

          <nav aria-label="Contest">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-200">Contest</h2>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#book" className="transition hover:text-white">The book</a></li>
              <li><a href="#prizes" className="transition hover:text-white">Prizes</a></li>
              <li><a href="#how-it-works" className="transition hover:text-white">How it works</a></li>
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-200">Account</h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/signup" className="transition hover:text-white">Sign up</Link></li>
              <li><Link href="/login" className="transition hover:text-white">Log in</Link></li>
              <li><Link href="/dashboard" className="transition hover:text-white">My dashboard</Link></li>
            </ul>
          </nav>

          <nav aria-label="Legal and help">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-200">Help &amp; legal</h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/faq" className="transition hover:text-white">FAQ</Link></li>
              <li><Link href="/official-rules" className="transition hover:text-white">Official Rules</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">Terms of Use</Link></li>
              <li><Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs leading-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
            <p>© {new Date().getFullYear()} {brandName}. Solve thoughtfully. Play fairly.</p>
            <p className="max-w-xl md:text-right">
              Prizes are subject to the Official Rules. Winners must be 18 or older to claim a prize.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

