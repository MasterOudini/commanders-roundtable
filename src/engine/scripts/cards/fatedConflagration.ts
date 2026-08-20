// `Fated Conflagration` — "Fated Conflagration deals 5 damage to target
// creature or planeswalker. If it's your turn, scry 2." The turn check is
// the active player at resolution; the conditional ask is LAST. D212.

import { FATED_CONFLAGRATION } from '../../../data/fixtures/engineCards';
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
  FATED_CONFLAGRATION,
  "Fated Conflagration deals 5 damage to target creature or planeswalker. If it's your turn, scry 2.",
);

export const FATED_CONFLAGRATION_SCRIPT: CardScript = {
  oracleId: FATED_CONFLAGRATION.oracleId,
  name: FATED_CONFLAGRATION.name,
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
      if (ctx.state.turn.activePlayer !== obj.controller) return events;
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
