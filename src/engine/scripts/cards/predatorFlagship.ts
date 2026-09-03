// `Predator, Flagship` — two abilities: {2} gives a creature flying until end
// of turn (the temporary keyword carrier), and {5}, {T} destroys a flyer.
// The second reads DERIVED keywords (D289), so a creature the first ability
// just lifted is a legal target for the second — the pairing the card was
// printed for.

import { PREDATOR_FLAGSHIP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  PREDATOR_FLAGSHIP,
  '{2}: Target creature gains flying until end of turn.\n{5}, {T}: Destroy target creature with flying.',
);
const LIFT = PRINTED.split('\n')[0] as string;
const DESTROY = PRINTED.split('\n')[1] as string;

export const PREDATOR_FLAGSHIP_SCRIPT: CardScript = {
  oracleId: PREDATOR_FLAGSHIP.oracleId,
  name: PREDATOR_FLAGSHIP.name,
  activated: [
    {
      ref: `${PREDATOR_FLAGSHIP.oracleId}#a0`,
      text: LIFT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] }];
      },
    },
    {
      ref: `${PREDATOR_FLAGSHIP.oracleId}#a1`,
      text: DESTROY,
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
  ],
};
