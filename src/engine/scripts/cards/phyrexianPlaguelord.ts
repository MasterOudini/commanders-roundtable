// `Phyrexian Plaguelord` — "{T}, Sacrifice this creature: Target creature
// gets -4/-4 until end of turn.\nSacrifice a creature: Target creature gets
// -1/-1 until end of turn." Disciple of Tevesh Szat's tap-and-self-sacrifice
// debuff (D274) and a creature-sacrifice chooser with NO mana at all (Aura
// Fracture's shape, D169) for the small one — which can eat the Plaguelord
// itself. Both resolves read only their target (D159). D278.

import { PHYREXIAN_PLAGUELORD } from '../../../data/fixtures/engineCards';
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
  PHYREXIAN_PLAGUELORD,
  '{T}, Sacrifice this creature: Target creature gets -4/-4 until end of turn.\nSacrifice a creature: Target creature gets -1/-1 until end of turn.',
);
const BIG = PRINTED.split('\n')[0] as string;
const SMALL = PRINTED.split('\n')[1] as string;

function shrink(ctx: ScriptCtx, obj: StackObject, amount: number): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -amount, toughness: -amount, keywords: [] }];
}

export const PHYREXIAN_PLAGUELORD_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_PLAGUELORD.oracleId,
  name: PHYREXIAN_PLAGUELORD.name,
  activated: [
    {
      ref: `${PHYREXIAN_PLAGUELORD.oracleId}#a0`,
      text: BIG,
      resolve: (ctx, _self, obj): readonly EventBody[] => shrink(ctx, obj, 4),
    },
    {
      ref: `${PHYREXIAN_PLAGUELORD.oracleId}#a1`,
      text: SMALL,
      resolve: (ctx, _self, obj): readonly EventBody[] => shrink(ctx, obj, 1),
    },
  ],
};
