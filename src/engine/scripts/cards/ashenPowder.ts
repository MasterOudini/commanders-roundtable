// `Ashen Powder` — "Put target creature card from an opponent's graveyard
// onto the battlefield under your control." D138's graveyard aim (the zone,
// the type and the OPPONENT controller all enforced at the spec) with Doomed
// Necromancer's move: an ordinary CardsMoved to the battlefield under the
// CASTER, so the entry funnel runs on the returned permanent. D198.

import { ASHEN_POWDER } from '../../../data/fixtures/engineCards';
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
  ASHEN_POWDER,
  "Put target creature card from an opponent's graveyard onto the battlefield under your control.",
);

export const ASHEN_POWDER_SCRIPT: CardScript = {
  oracleId: ASHEN_POWDER.oracleId,
  name: ASHEN_POWDER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: card.zone.player },
              to: { kind: 'battlefield', player: obj.controller },
            },
          ],
        },
      ];
    },
  },
};
