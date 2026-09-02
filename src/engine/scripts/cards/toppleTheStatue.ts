// `Topple the Statue` — the target permanent is tapped; an artifact is
// destroyed as well; a card either way.

import { TOPPLE_THE_STATUE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TOPPLE_THE_STATUE, "Tap target permanent. If it's an artifact, destroy it.\nDraw a card.");

export const TOPPLE_THE_STATUE_SCRIPT: CardScript = {
  oracleId: TOPPLE_THE_STATUE.oracleId,
  name: TOPPLE_THE_STATUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (!card.tapped) events.push({ t: 'PermanentsTapped', cards: [target.id] });
      if (ctx.derive(target.id).typeLine.types.includes('Artifact')) {
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
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
