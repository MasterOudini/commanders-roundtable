// `Roku's Mastery` — "Roku's Mastery deals X damage to target creature.
// If X is 4 or more, scry 2." Fated Conflagration's conditional scry
// with the condition on the CHOSEN X; the ask stays LAST (D195). D241.

import { ROKU_S_MASTERY } from '../../../data/fixtures/engineCards';
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
  ROKU_S_MASTERY,
  "Roku's Mastery deals X damage to target creature. If X is 4 or more, scry 2. " +
    '(Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
);

export const ROKUS_MASTERY_SCRIPT: CardScript = {
  oracleId: ROKU_S_MASTERY.oracleId,
  name: ROKU_S_MASTERY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: x,
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
      if (x < 4) return events;
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n === 0) return events;
      const top = library.slice(library.length - n);
      events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'scryChoice',
          player: obj.controller,
          count: n,
          toGraveyard: false,
          thenDraw: 0,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
