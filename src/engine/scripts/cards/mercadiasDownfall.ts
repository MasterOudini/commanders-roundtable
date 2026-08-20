// `Mercadia's Downfall` — "Each attacking creature gets +1/+0 until end of
// turn for each nonbasic land defending player controls." The per-attacker
// combat pump: each attacker's OWN defending player (Meriadoc's DefenderRef —
// a planeswalker's controller when the swing is at one) is censused for
// nonbasic lands, so two attackers at two defenders can get two different
// bonuses. D224.

import { MERCADIA_S_DOWNFALL } from '../../../data/fixtures/engineCards';
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
  MERCADIA_S_DOWNFALL,
  'Each attacking creature gets +1/+0 until end of turn for each nonbasic land defending player controls.',
);

export const MERCADIAS_DOWNFALL_SCRIPT: CardScript = {
  oracleId: MERCADIA_S_DOWNFALL.oracleId,
  name: MERCADIA_S_DOWNFALL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        const attacker = ctx.state.cards[a.card];
        if (!attacker || attacker.zone.kind !== 'battlefield') continue;
        const defender =
          a.defender.kind === 'player' ? a.defender.id : ctx.query.controllerOf(a.defender.id);
        if (!defender) continue;
        let n = 0;
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== defender) continue;
          const d = ctx.derive(id);
          if (!d.typeLine.types.includes('Land')) continue;
          if (d.typeLine.supertypes.includes('Basic')) continue;
          n++;
        }
        if (n === 0) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: n, toughness: 0 });
      }
      return events;
    },
  },
};
