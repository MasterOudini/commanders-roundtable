// `Angel of Despair` — "Flying\nWhen this creature enters, destroy target
// permanent." The first script DESTROY (M6.4d, D161) — and destroy answers to
// indestructible, a Tier-2 keyword the engine advertises, so the def checks
// the DERIVED target exactly as `effects.ts`'s destroy does. Skipping it would
// make the app wrong about a keyword it enforces everywhere else.

import { ANGEL_OF_DESPAIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANGEL_OF_DESPAIR, 'Flying\nWhen this creature enters, destroy target permanent.');
const TEXT = PRINTED.split('\n')[1] as string;

export const ANGEL_OF_DESPAIR_SCRIPT: CardScript = {
  oracleId: ANGEL_OF_DESPAIR.oracleId,
  name: ANGEL_OF_DESPAIR.name,
  triggers: [
    {
      abilityId: 'etb',
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
      label: () => 'Angel of Despair — destroy target permanent',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed. The event
        // simply does not happen; the ability still resolves.
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
