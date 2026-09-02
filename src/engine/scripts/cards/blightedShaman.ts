// `Blighted Shaman` — "{T}, Sacrifice a Swamp: Target creature gets +1/+1
// until end of turn.\n{T}, Sacrifice a creature: Target creature gets +2/+2
// until end of turn." Two chooser-cost pumps on the tap carrier: the Swamp
// price is Strands of Night's (D254), the creature price D168's chooser, and
// each is charged at activation — the second can even eat the Shaman
// itself, which is why both resolves read the target and never `self`. D272.

import { BLIGHTED_SHAMAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
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
  BLIGHTED_SHAMAN,
  '{T}, Sacrifice a Swamp: Target creature gets +1/+1 until end of turn.\n{T}, Sacrifice a creature: Target creature gets +2/+2 until end of turn.',
);
const SWAMP_PUMP = PRINTED.split('\n')[0] as string;
const CREATURE_PUMP = PRINTED.split('\n')[1] as string;

function pump(ctx: ScriptCtx, obj: StackObject, amount: number): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: amount, toughness: amount, keywords: [] }];
}

export const BLIGHTED_SHAMAN_SCRIPT: CardScript = {
  oracleId: BLIGHTED_SHAMAN.oracleId,
  name: BLIGHTED_SHAMAN.name,
  activated: [
    {
      ref: `${BLIGHTED_SHAMAN.oracleId}#a0`,
      text: SWAMP_PUMP,
      resolve: (ctx, _self: InstanceId, obj): readonly EventBody[] => pump(ctx, obj, 1),
    },
    {
      ref: `${BLIGHTED_SHAMAN.oracleId}#a1`,
      text: CREATURE_PUMP,
      resolve: (ctx, _self: InstanceId, obj): readonly EventBody[] => pump(ctx, obj, 2),
    },
  ],
};
