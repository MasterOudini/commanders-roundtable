// `Affa Guard Hound` — "Flash\nWhen this creature enters, target creature gets
// +0/+3 until end of turn." Flash is Tier-2's; the def owes the targeted ETB
// pump — the first script `PtModifiedUntilEndOfTurn` (layer 7c, cleaned up by
// the engine at CR 514.2). M6.4c, D160.

import { AFFA_GUARD_HOUND } from '../../../data/fixtures/engineCards';
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
  AFFA_GUARD_HOUND,
  'Flash (You may cast this spell any time you could cast an instant.)\nWhen this creature enters, target creature gets +0/+3 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AFFA_GUARD_HOUND_SCRIPT: CardScript = {
  oracleId: AFFA_GUARD_HOUND.oracleId,
  name: AFFA_GUARD_HOUND.name,
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
      label: () => 'Affa Guard Hound — target creature gets +0/+3 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 3 }];
      },
    },
  ],
};
