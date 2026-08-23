// `Viridian Corrupter` — the ETB artifact destroy. FOUR oracle ids now carry this exact
// printed line (Uktabi Orangutan shipped in D263), so the three new ones are
// generated from one base rather than copied. D266.

import { VIRIDIAN_CORRUPTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIRIDIAN_CORRUPTER, 'Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\nWhen this creature enters, destroy target artifact.');
const TEXT = PRINTED.split('\n')[1] as string;

export const VIRIDIAN_CORRUPTER_SCRIPT: CardScript = {
  oracleId: VIRIDIAN_CORRUPTER.oracleId,
  name: VIRIDIAN_CORRUPTER.name,
  triggers: [
    {
      abilityId: 'etb-destroy',
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
      label: () => 'Viridian Corrupter — destroy target artifact',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
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
