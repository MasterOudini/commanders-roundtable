// `Run Aground` — "Put target artifact or creature on top of its owner's
// library." Mystic Repeal's placement move at the TOP, on the PROBED
// artifact-or-creature compound (both kinds parse). D242.

import { RUN_AGROUND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RUN_AGROUND, "Put target artifact or creature on top of its owner's library.");

export const RUN_AGROUND_SCRIPT: CardScript = {
  oracleId: RUN_AGROUND.oracleId,
  name: RUN_AGROUND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'library', player: card.owner },
              placement: 'top',
            },
          ],
        },
      ];
    },
  },
};
