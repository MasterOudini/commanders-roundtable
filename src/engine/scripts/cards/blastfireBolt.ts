// `Blastfire Bolt` — "Blastfire Bolt deals 5 damage to target creature.
// Destroy all Equipment attached to that creature." The damage, then the
// attachments filtered to DERIVED Equipment — Darksteel Axe would survive
// its own indestructibility (CR 701.7b). D200.

import { BLASTFIRE_BOLT } from '../../../data/fixtures/engineCards';
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
  BLASTFIRE_BOLT,
  'Blastfire Bolt deals 5 damage to target creature. Destroy all Equipment attached to that creature.',
);

export const BLASTFIRE_BOLT_SCRIPT: CardScript = {
  oracleId: BLASTFIRE_BOLT.oracleId,
  name: BLASTFIRE_BOLT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
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
      const moves = [];
      for (const att of card.attachments) {
        const a = ctx.state.cards[att];
        if (!a || a.zone.kind !== 'battlefield') continue;
        const d = ctx.derive(att);
        if (!d.typeLine.subtypes.includes('Equipment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: att,
          from: { kind: 'battlefield' as const, player: a.controller },
          to: { kind: 'graveyard' as const, player: a.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
