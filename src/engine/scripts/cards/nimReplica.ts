// `Nim Replica` — "{2}{B}, Sacrifice this creature: Target creature gets
// -1/-1 until end of turn." Neurok Replica's shape on a debuff. D228.

import { NIM_REPLICA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const TEXT = printed(
  NIM_REPLICA,
  '{2}{B}, Sacrifice this creature: Target creature gets -1/-1 until end of turn.',
);

export const NIM_REPLICA_SCRIPT: CardScript = {
  oracleId: NIM_REPLICA.oracleId,
  name: NIM_REPLICA.name,
  activated: [
    {
      ref: `${NIM_REPLICA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
