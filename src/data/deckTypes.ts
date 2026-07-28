import type { CardData, ColorLetter } from './cardTypes';

/** Where a line belongs. Only `commander` and `main` count toward the 100. */
export type DeckSection =
  | 'commander'
  | 'main'
  | 'sideboard'
  | 'maybeboard'
  | 'companion'
  | 'tokens';

export interface DeckEntry {
  quantity: number;
  /** The card name exactly as written, before any folding. */
  name: string;
  /** Set code, when the line named a specific printing. */
  set?: string;
  collectorNumber?: string;
  foil?: boolean;
  section: DeckSection;
  /** 1-based, so a validation message can point at the line the user typed. */
  lineNo: number;
  raw: string;
}

export interface DecklistComment {
  lineNo: number;
  text: string;
}

export interface DecklistProblem {
  lineNo: number;
  raw: string;
  reason: string;
}

export interface ParsedDecklist {
  entries: DeckEntry[];
  comments: DecklistComment[];
  /** Lines that could not be read as a card at all. Never silently dropped. */
  problems: DecklistProblem[];
  /** True when the list used explicit section markers rather than being one block. */
  hadSections: boolean;
}

/** A saved deck. `cards` holds only what the user chose; card data is looked up. */
export interface DeckFile {
  id: string;
  name: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  commanders: DeckEntry[];
  main: DeckEntry[];
  /** Kept for reference; never counted or validated. */
  sideboard: DeckEntry[];
  /**
   * The pod agreed to play it anyway. Validation still reports everything; this
   * only stops the deck being treated as unusable.
   */
  houseRuled: boolean;
  /** The original pasted text, so a re-import can be diffed or re-run. */
  sourceText?: string;
}

export type IssueCode =
  | 'deck-size'
  | 'singleton'
  | 'commander-missing'
  | 'commander-illegal'
  | 'commander-too-many'
  | 'partner-mismatch'
  | 'color-identity'
  | 'banned'
  | 'not-legal-in-format'
  | 'unresolved'
  | 'sideboard-ignored'
  | 'stale-card-data';

export interface ValidationIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  /** Written from the user's side: what happened, and what to do about it. */
  message: string;
  cardName?: string;
  lineNo?: number;
  /** Structured detail for the UI, e.g. which colours are offending. */
  detail?: Record<string, unknown>;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  counts: {
    /** Commanders + main, by quantity. */
    total: number;
    unique: number;
    commanders: number;
  };
  colorIdentity: ColorLetter[];
  /** Which release the verdict was computed against — the ban list ages with it. */
  cardDataUpdatedAt: string | null;
}

/** A resolved deck: entries paired with their card data. */
export interface ResolvedEntry {
  entry: DeckEntry;
  card: CardData | null;
  suggestions?: string[];
}
