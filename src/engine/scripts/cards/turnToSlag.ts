// `Turn to Slag` — 5 damage AND every Equipment attached to that creature
// destroyed (Blastfire Bolt's attachment walk, D200).
//
// ⚠️ The attachment list is read off `ctx.state`, which is the PRE-resolution
// board — so the Equipment is still attached even though the damage in the
// same event will kill its host. That is the correct reading here (both
// happen on resolution, and CR 704 unattaches only afterwards), and it is
// worth saying because D260's Tidy Conclusion and D261's Too Greedily both
// turned on this exact property in the other direction. D263.

import { TURN_TO_SLAG } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TURN_TO_SLAG,
  'Turn to Slag deals 5 damage to target creature. Destroy all Equipment attached to that creature.',
);

export const TURN_TO_SLAG_SCRIPT: CardScript = {
  oracleId: TURN_TO_SLAG.oracleId,
  name: TURN_TO_SLAG.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];

      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 5,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];

      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.attachedTo !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.subtypes.includes('Equipment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: inst.controller },
          to: { kind: 'graveyard', player: inst.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
