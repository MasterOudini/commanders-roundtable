// `Stalking Assassin` - two abilities on one card: a tap, and a destroy that only
// a TAPPED creature can be aimed at (the adjective is the parser's and the
// validator's, D294). Hand-written because the D295 table emits one def per card.

import { STALKING_ASSASSIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STALKING_ASSASSIN, '{3}{U}, {T}: Tap target creature.\n{3}{B}, {T}: Destroy target tapped creature.');
const TAP_TEXT = PRINTED.split('\n')[0] as string;
const DESTROY_TEXT = PRINTED.split('\n')[1] as string;

export const STALKING_ASSASSIN_SCRIPT: CardScript = {
  oracleId: STALKING_ASSASSIN.oracleId,
  name: STALKING_ASSASSIN.name,
  activated: [
    {
      ref: `${STALKING_ASSASSIN.oracleId}#a0`,
      text: TAP_TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      ref: `${STALKING_ASSASSIN.oracleId}#a1`,
      text: DESTROY_TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b - an indestructible permanent is not destroyed.
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
  ],
};
