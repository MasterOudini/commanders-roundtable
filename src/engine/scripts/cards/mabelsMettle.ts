// `Mabel's Mettle` — the first target gets +2/+2, the optional second
// ("up to one other") +1/+1, until cleanup. The clauses are answered in
// order: the required clause first, so a single target is the +2/+2 one.

import { MABEL_S_METTLE } from '../../../data/fixtures/engineCards';
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
  MABEL_S_METTLE,
  'Target creature gets +2/+2 until end of turn. Up to one other target creature gets +1/+1 until end of turn.',
);

export const MABELS_METTLE_SCRIPT: CardScript = {
  oracleId: MABEL_S_METTLE.oracleId,
  name: MABEL_S_METTLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const cards = obj.targets.filter((t) => t.kind === 'card');
      const first = cards[0];
      const second = cards[1];
      if (first && ctx.state.cards[first.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: first.id, power: 2, toughness: 2, keywords: [] });
      }
      if (second && ctx.state.cards[second.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: second.id, power: 1, toughness: 1, keywords: [] });
      }
      return events;
    },
  },
};
