// `Nimraiser Paladin` — "When this creature enters, return target creature
// card with mana value 3 or less from your graveyard to your hand." The
// D139-floored graveyard return to HAND on an ETB trigger; the toxic line
// is Tier 2. D228.

import { NIMRAISER_PALADIN } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  NIMRAISER_PALADIN,
  'Toxic 2 (Players dealt combat damage by this creature also get two poison counters.)\nWhen this creature enters, return target creature card with mana value 3 or less from your graveyard to your hand.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const NIMRAISER_PALADIN_SCRIPT: CardScript = {
  oracleId: NIMRAISER_PALADIN.oracleId,
  name: NIMRAISER_PALADIN.name,
  triggers: [
    {
      abilityId: 'etb-return',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Nimraiser Paladin — return a cheap creature card to hand',
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
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
