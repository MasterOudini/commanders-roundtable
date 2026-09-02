// `Disciple of Tevesh Szat` — "{T}: Target creature gets -1/-1 until end of
// turn.\n{4}{B}{B}, {T}, Sacrifice this creature: Target creature gets -6/-6
// until end of turn." Wyluli Wolf's tap debuff (D271) and a self-sacrifice
// activation whose tap AND sacrifice are charged at activation (D159) — the
// second resolve runs with the Disciple already in the graveyard and reads
// only its target. D274.

import { DISCIPLE_OF_TEVESH_SZAT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(
  DISCIPLE_OF_TEVESH_SZAT,
  '{T}: Target creature gets -1/-1 until end of turn.\n{4}{B}{B}, {T}, Sacrifice this creature: Target creature gets -6/-6 until end of turn.',
);
const SMALL = PRINTED.split('\n')[0] as string;
const LARGE = PRINTED.split('\n')[1] as string;

function shrink(ctx: ScriptCtx, obj: StackObject, amount: number): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -amount, toughness: -amount, keywords: [] }];
}

export const DISCIPLE_OF_TEVESH_SZAT_SCRIPT: CardScript = {
  oracleId: DISCIPLE_OF_TEVESH_SZAT.oracleId,
  name: DISCIPLE_OF_TEVESH_SZAT.name,
  activated: [
    {
      ref: `${DISCIPLE_OF_TEVESH_SZAT.oracleId}#a0`,
      text: SMALL,
      resolve: (ctx, _self, obj): readonly EventBody[] => shrink(ctx, obj, 1),
    },
    {
      ref: `${DISCIPLE_OF_TEVESH_SZAT.oracleId}#a1`,
      text: LARGE,
      resolve: (ctx, _self, obj): readonly EventBody[] => shrink(ctx, obj, 6),
    },
  ],
};
