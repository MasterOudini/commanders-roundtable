// D576 - SPLICE (CR 702.47): the cards spliced onto a spell, read back as faces, and their effects after the spell's own.
import { faceOf } from './oracle';
import type { EffectSpec, OracleDb, OracleFace } from './types/oracle';
import type { SplicedCard } from './types/state';

/** The spliced cards' faces, in the order they were revealed (a printing the oracle does not hold is skipped). */
export function splicedFaces(oracle: OracleDb, spliced: readonly SplicedCard[] | undefined): readonly OracleFace[] {
  const out: OracleFace[] = [];
  for (const s of spliced ?? []) {
    const card = oracle.byPrinting(s.printingId);
    if (card) out.push(faceOf(card, s.faceIndex));
  }
  return out;
}

/**
 * A clause's target indices past the `base` clauses declared before it - its subject and a fight's or a bite's other
 * (`otherTargetIndex`). D576's spliced cards and D577's chosen modes (modalEffects) both run through it; a clause that moves
 * nothing is returned as it is.
 */
export function shiftedClause(e: EffectSpec, base: number): EffectSpec {
  const moves = !(e.self || e.targetIndex === -1);
  if (base === 0 || (!moves && e.otherTargetIndex === undefined)) return e;
  return {
    ...e,
    ...(moves ? { targetIndex: e.targetIndex + base } : {}),
    ...(e.otherTargetIndex !== undefined ? { otherTargetIndex: e.otherTargetIndex + base } : {}),
  };
}

/**
 * The spell's effects with every spliced card's after them (CR 702.47b), each spliced clause's target indices shifted past
 * the clauses before it - the order the cast declared its targets in (castTargetSpecs appends the spliced clauses the same
 * way; modalEffects' arithmetic). `~` in a spliced text is the spell itself (CR 702.47c): the effects' source.
 */
export function withSpliced(face: OracleFace, spliced: readonly OracleFace[]): readonly EffectSpec[] {
  if (spliced.length === 0) return face.effects;
  const out: EffectSpec[] = [...face.effects];
  let base = face.targets.length;
  for (const f of spliced) {
    for (const e of f.effects) out.push(shiftedClause(e, base));
    base += f.targets.length;
  }
  return out;
}
