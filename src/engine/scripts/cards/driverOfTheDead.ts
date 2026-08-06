// `Driver of the Dead` — "When this creature dies, return target creature
// card with mana value 2 or less from your graveyard to the battlefield."
// Archon of Justice's looks-back-AND-targets shape driving Doomed
// Necromancer's reanimation, with D139's numeric restriction on the aim —
// the whole clause reads through targetParse (zone + card type + mana
// value, D140's both-orders fix). M6.4p, D172.

import { DRIVER_OF_THE_DEAD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  DRIVER_OF_THE_DEAD,
  'When this creature dies, return target creature card with mana value 2 or less from your graveyard to the battlefield.',
);

export const DRIVER_OF_THE_DEAD_SCRIPT: CardScript = {
  oracleId: DRIVER_OF_THE_DEAD.oracleId,
  name: DRIVER_OF_THE_DEAD.name,
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
      label: () => 'Driver of the Dead — return the target to the battlefield',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        if (card.zone.player !== obj.controller) return [];
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
  ],
};
