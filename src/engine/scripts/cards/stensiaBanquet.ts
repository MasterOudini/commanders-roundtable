// `Stensia Banquet` — "Stensia Banquet deals damage to target opponent or
// planeswalker equal to the number of Vampires you control.\nDraw a card."
// Kiss of Death's opponent-or-planeswalker aim with the amount counted off
// my derived Vampires at resolution — none means no damage event at all —
// then the draw. D281.

import { STENSIA_BANQUET } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  STENSIA_BANQUET,
  'Stensia Banquet deals damage to target opponent or planeswalker equal to the number of Vampires you control.\nDraw a card.',
);

export const STENSIA_BANQUET_SCRIPT: CardScript = {
  oracleId: STENSIA_BANQUET.oracleId,
  name: STENSIA_BANQUET.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      const legal =
        target.kind === 'player'
          ? !ctx.state.players[target.id]?.hasLost
          : ctx.state.cards[target.id]?.zone.kind === 'battlefield';
      if (!legal) return [];
      let vampires = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Vampire')) vampires += 1;
      }
      const events: EventBody[] = [];
      if (vampires > 0) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
              amount: vampires,
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
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
