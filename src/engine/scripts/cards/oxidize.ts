// `Oxidize` — "Destroy target artifact. It can't be regenerated." The
// artifact destroy; its printed regeneration clause is VACUOUS while the
// engine has none, and this module's name joins the tripwire's client
// list so the day one appears it fails by file name. D231.

import { OXIDIZE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(OXIDIZE, "Destroy target artifact. It can't be regenerated.");

export const OXIDIZE_SCRIPT: CardScript = {
  oracleId: OXIDIZE.oracleId,
  name: OXIDIZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
