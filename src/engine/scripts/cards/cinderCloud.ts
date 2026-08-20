// `Cinder Cloud` — "Destroy target creature. If a white creature dies this
// way, Cinder Cloud deals damage to that creature's controller equal to
// the creature's power." Color and power read off the DERIVED victim
// BEFORE the move; indestructible survives and nobody burns. D203.

import { CINDER_CLOUD } from '../../../data/fixtures/engineCards';
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
  CINDER_CLOUD,
  "Destroy target creature. If a white creature dies this way, Cinder Cloud deals damage to that creature's controller equal to the creature's power.",
);

export const CINDER_CLOUD_SCRIPT: CardScript = {
  oracleId: CINDER_CLOUD.oracleId,
  name: CINDER_CLOUD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      if (d.keywords.has('indestructible')) return [];
      const white = d.colors.includes('W');
      const power = d.power ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
      if (white && power > 0) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: card.controller },
              amount: power,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
