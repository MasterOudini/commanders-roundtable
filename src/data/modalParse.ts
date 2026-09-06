/**
 * D343 — THE MODAL SEAM, the read: an instant or sorcery whose WHOLE text is
 * "Choose <word> —" and its "• mode" lines. Each mode is parsed on its own — its
 * target clauses by the target parser, its sentences by the effect vocabulary —
 * so a modal spell is `auto` exactly when EVERY mode is, and the cast can aim
 * the chosen modes' clauses and resolve the chosen modes' text (`engine/modes.ts`).
 *
 * ⚠️ THE WHOLE TEXT, deliberately (v1): a modal group beside other sentences
 * ("Convoke", "Escalate {2}", a kicker) is a different shape, and reading the
 * modes while ignoring the rest would be the half-execution D90 forbids. Such a
 * face stays what it was — one free target spec for the whole face and a
 * `manual` effect mode.
 *
 * ⚠️ A PERMANENT's modal abilities are not read here: their modes live on the
 * `TriggerDef` / `ActivatedDef` a card script declares (`ModeDecl`), because a
 * permanent's line resolves through a script and never through the vocabulary.
 */
import type { ModalFace, ModeSpec } from '../engine/types/oracle';
import { modeChoiceOf } from '../engine/modes';
import { parseEffects } from './effectParse';
import { parseTargetClauses } from './targetParse';
import type { Warn } from './oracleParse';

const HEAD = /^Choose (one|two|three|one or both|one or more|any number) —$/;
const NOOP: Warn = () => undefined;

export function parseModalFace(oracleText: string, cardName: string, isInstantOrSorcery: boolean, warn: Warn = NOOP): ModalFace | null {
  if (!isInstantOrSorcery || !oracleText) return null;
  const lines = oracleText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  const head = HEAD.exec(lines[0] ?? '');
  if (!head || lines.length < 2 || !lines.slice(1).every((l) => l.startsWith('• '))) return null;
  const texts = lines.slice(1).map((l) => l.slice(2).trim());
  const choice = modeChoiceOf(head[1] ?? '', texts.length);
  if (!choice) return null;
  const modes: ModeSpec[] = texts.map((text) => {
    // The target clauses are counted into the face's own report (they are its
    // clauses); the effect read of each mode is silent here and the face warns
    // ONCE from its aggregate, so a modal face counts as one face in the report.
    const parsed = parseEffects(text, cardName, true);
    return { text, targets: parseTargetClauses(text, warn), effects: parsed.effects, effectMode: parsed.mode };
  });
  return { line: 0, min: choice.min, max: choice.max, modes };
}
