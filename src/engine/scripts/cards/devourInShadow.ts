// `Devour in Shadow` — "Destroy target creature. It can't be regenerated.
// You lose life equal to that creature's toughness." The toughness is read
// off the DERIVED pre-move state, and the loss lands whether or not the
// creature dies (the words tie it to the creature — Death's Caress's
// Certain Death precedent, D206). The middle sentence is vacuous under the
// damnation tripwire. D208.

import { DEVOUR_IN_SHADOW } from '../../../data/fixtures/engineCards';
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
  DEVOUR_IN_SHADOW,
  "Destroy target creature. It can't be regenerated. You lose life equal to that creature's toughness.",
);

export const DEVOUR_IN_SHADOW_SCRIPT: CardScript = {
  oracleId: DEVOUR_IN_SHADOW.oracleId,
  name: DEVOUR_IN_SHADOW.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const toughness = d.toughness ?? 0;
      const events: EventBody[] = [];
      if (!d.keywords.has('indestructible')) {
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
      const me = ctx.state.players[obj.controller];
      if (toughness > 0 && me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: -toughness,
          to: me.life - toughness,
        });
      }
      return events;
    },
  },
};
