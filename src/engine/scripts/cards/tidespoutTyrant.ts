// `Tidespout Tyrant` — the any-spell cast watcher whose payload is a
// TARGETED MOVE rather than a token or a counter (Contemplation's watcher,
// D169, meeting Temporal Adept's bounce, D257). The flying line is the
// engine's keyword; this def claims only the trigger.
//
// ⚠️ It watches MY casts only, and the Tyrant's own cast is included — the
// trigger's `activeZones` is the battlefield, so the Tyrant is not yet there
// when its own spell is cast and cannot pay for itself. D260.

import { TIDESPOUT_TYRANT } from '../../../data/fixtures/engineCards';
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
  TIDESPOUT_TYRANT,
  "Flying\nWhenever you cast a spell, return target permanent to its owner's hand.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TIDESPOUT_TYRANT_SCRIPT: CardScript = {
  oracleId: TIDESPOUT_TYRANT.oracleId,
  name: TIDESPOUT_TYRANT.name,
  triggers: [
    {
      abilityId: 'cast-bounce',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: () => "Tidespout Tyrant — return target permanent to its owner's hand",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
