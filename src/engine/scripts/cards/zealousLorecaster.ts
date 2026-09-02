// `Zealous Lorecaster` — "When this creature enters, return target instant or
// sorcery card from your graveyard to your hand." The PROBED compound
// graveyard noun: `zones:["graveyard"], cardTypes:["Instant","Sorcery"],
// controller:you`, fully structured, so the aim layer enforces every part and
// the def owes only the move. D271.

import { ZEALOUS_LORECASTER } from '../../../data/fixtures/engineCards';
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
  ZEALOUS_LORECASTER,
  'When this creature enters, return target instant or sorcery card from your graveyard to your hand.',
);

export const ZEALOUS_LORECASTER_SCRIPT: CardScript = {
  oracleId: ZEALOUS_LORECASTER.oracleId,
  name: ZEALOUS_LORECASTER.name,
  triggers: [
    {
      abilityId: 'etb-regrow',
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
      label: () => 'Zealous Lorecaster — return target instant or sorcery card to your hand',
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
                from: { kind: 'graveyard', player: card.owner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
