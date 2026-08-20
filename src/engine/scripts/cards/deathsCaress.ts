// `Death's Caress` — "Destroy target creature. If that creature was a
// Human, you gain life equal to its toughness." The rider is NOT
// "destroyed this way": like Certain Death's ruled shape, the second
// sentence checks the creature, not the destruction — an indestructible
// Human survives the destroy and the gain still fires. Both facts are read
// off the DERIVED pre-move state (D204's Consuming Ashes idiom). D206.

import { DEATH_S_CARESS } from '../../../data/fixtures/engineCards';
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
  DEATH_S_CARESS,
  'Destroy target creature. If that creature was a Human, you gain life equal to its toughness.',
);

export const DEATHS_CARESS_SCRIPT: CardScript = {
  oracleId: DEATH_S_CARESS.oracleId,
  name: DEATH_S_CARESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const isHuman = d.typeLine.subtypes.includes('Human');
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
      if (isHuman && toughness > 0 && me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: toughness,
          to: me.life + toughness,
        });
      }
      return events;
    },
  },
};
