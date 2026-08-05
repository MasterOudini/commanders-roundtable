// `Archon of Justice` — "Flying\nWhen this creature dies, exile target
// permanent." The first trigger that both LOOKS BACK and TARGETS — D147 built
// each half separately; this card is the first shipped combination. Exile
// answers to nothing indestructible answers to (CR 701.7 is about destroy).
// M6.4d, D161.

import { ARCHON_OF_JUSTICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHON_OF_JUSTICE, 'Flying\nWhen this creature dies, exile target permanent.');
const TEXT = PRINTED.split('\n')[1] as string;

export const ARCHON_OF_JUSTICE_SCRIPT: CardScript = {
  oracleId: ARCHON_OF_JUSTICE.oracleId,
  name: ARCHON_OF_JUSTICE.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Archon of Justice — exile target permanent',
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
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
