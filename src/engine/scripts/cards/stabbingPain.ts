// `Stabbing Pain` — "-1/-1 until end of turn. Tap that creature." Two
// sentences, ONE target: the anaphora resolves in the same pass. D252.

import { STABBING_PAIN } from '../../../data/fixtures/engineCards';
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
  STABBING_PAIN,
  'Target creature gets -1/-1 until end of turn. Tap that creature.',
);

export const STABBING_PAIN_SCRIPT: CardScript = {
  oracleId: STABBING_PAIN.oracleId,
  name: STABBING_PAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 },
      ];
      if (!card.tapped) events.push({ t: 'PermanentsTapped', cards: [target.id] });
      return events;
    },
  },
};
