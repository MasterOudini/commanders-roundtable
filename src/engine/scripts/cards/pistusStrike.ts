// `Pistus Strike` — destroy the flyer, then its controller takes a poison
// counter. The flying restriction is enforced by the parser and validator
// (D289); the counter goes to whoever controls the creature as it dies.

import { PISTUS_STRIKE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PISTUS_STRIKE, 'Destroy target creature with flying. Its controller gets a poison counter.');

export const PISTUS_STRIKE_SCRIPT: CardScript = {
  oracleId: PISTUS_STRIKE.oracleId,
  name: PISTUS_STRIKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const p = ctx.state.players[card.controller];
      if (p) events.push({ t: 'PoisonChanged', player: card.controller, delta: 1, to: p.poison + 1 });
      return events;
    },
  },
};
