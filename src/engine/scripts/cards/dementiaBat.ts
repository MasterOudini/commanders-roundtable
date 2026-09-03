// `Dementia Bat` — Flying is the engine's; five mana and the Bat itself have
// the target player choose two cards of their hand to discard.

import { DEMENTIA_BAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEMENTIA_BAT, 'Flying\n{4}{B}, Sacrifice this creature: Target player discards two cards.');
const DISCARD = PRINTED.split('\n')[1] as string;

export const DEMENTIA_BAT_SCRIPT: CardScript = {
  oracleId: DEMENTIA_BAT.oracleId,
  name: DEMENTIA_BAT.name,
  activated: [
    {
      ref: `${DEMENTIA_BAT.oracleId}#a0`,
      text: DISCARD,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const victim = ctx.state.players[target.id];
        if (!victim || victim.hasLost) return [];
        const hand = ctx.state.zones.hand[target.id] ?? [];
        const count = Math.min(2, hand.length);
        if (count === 0) return [];
        return [
          {
            t: 'AwaitingSet',
            awaiting: { kind: 'chooseFromZone', player: target.id, zone: 'hand', rest: null, count, label: obj.label },
          },
        ];
      },
    },
  ],
};
