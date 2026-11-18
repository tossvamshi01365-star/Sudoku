export type UserType = 'book_buyer' | 'free_player';

export type ProofStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type PrizeType = 'per_puzzle' | 'grand_prize';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  user_type: UserType;
  proof_status: ProofStatus;
  is_age_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingItem<T = unknown> {
  key: string;
  value: T;
  description?: string;
  updated_at: string;
}

export interface ProofRecord {
  id: string;
  user_id: string;
  order_id: string;
  order_screenshot_path: string;
  book_photo_path: string;
  status: ProofStatus;
  rejection_reason?: string | null;
  rejection_instructions?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}

export interface Puzzle {
  id: number;
  given_digits: (number | null)[][];
  created_at: string;
  updated_at: string;
}

export interface OfficialSolution {
  id: string;
  puzzle_id: number;
  solution_digits: number[][];
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  puzzle_id: number;
  submitted_digits: number[][];
  photo_path: string | null;
  submitted_at: string;
}

export interface SubmissionHistory {
  id: string;
  original_submission_id: string;
  user_id: string;
  puzzle_id: number;
  submitted_digits: number[][];
  photo_path: string | null;
  original_submitted_at: string;
  unlocked_at: string;
  unlocked_by: string;
}

export interface ResultRecord {
  id: string;
  puzzle_id: number | null;
  user_id: string;
  is_correct: boolean;
  prize_type: PrizeType;
  prize_amount: number;
  is_published: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_identifier: string;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/**
 * Standard Sudoku rules validator.
 * Validates that a 9x9 grid satisfies standard Sudoku rules:
 * - Each row contains digits 1-9 without duplicates
 * - Each column contains digits 1-9 without duplicates
 * - Each 3x3 block contains digits 1-9 without duplicates
 * - Prefilled/given digits match unchanged
 */
export function validateSudokuRules(
  grid: number[][],
  givenDigits?: (number | null)[][]
): { isValid: boolean; error?: string } {
  if (!grid || grid.length !== 9) {
    return { isValid: false, error: 'Grid must have 9 rows' };
  }

  for (let r = 0; r < 9; r++) {
    if (!grid[r] || grid[r].length !== 9) {
      return { isValid: false, error: `Row ${r + 1} must have 9 columns` };
    }
  }

  // Check that given digits match
  if (givenDigits && givenDigits.length === 9) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const given = givenDigits[r][c];
        if (given !== null && given !== undefined && grid[r][c] !== given) {
          return {
            isValid: false,
            error: `Given digit at row ${r + 1}, column ${c + 1} was modified`
          };
        }
      }
    }
  }

  // Check each cell is 1-9
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (typeof val !== 'number' || val < 1 || val > 9 || !Number.isInteger(val)) {
        return { isValid: false, error: 'Every cell must be a whole digit between 1 and 9' };
      }
    }
  }

  // Validate rows
  for (let r = 0; r < 9; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (seen.has(val)) {
        return { isValid: false, error: `Duplicate number ${val} in row ${r + 1}` };
      }
      seen.add(val);
    }
  }

  // Validate columns
  for (let c = 0; c < 9; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < 9; r++) {
      const val = grid[r][c];
      if (seen.has(val)) {
        return { isValid: false, error: `Duplicate number ${val} in column ${c + 1}` };
      }
      seen.add(val);
    }
  }

  // Validate 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set<number>();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const val = grid[boxRow * 3 + r][boxCol * 3 + c];
          if (seen.has(val)) {
            return {
              isValid: false,
              error: `Duplicate number ${val} in 3x3 block (${boxRow + 1}, ${boxCol + 1})`
            };
          }
          seen.add(val);
        }
      }
    }
  }

  return { isValid: true };
}

