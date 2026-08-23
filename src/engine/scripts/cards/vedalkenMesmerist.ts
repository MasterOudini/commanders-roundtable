// `Vedalken Mesmerist` — the SELF-filtered attack trigger (Burrenton
// Shield-Bearers' shape, D166) carrying a target: the declaration is one
// event and the filter is "is one of these attackers me", which is
// granularity-safe by construction. D265.

import { VEDALKEN_MESMERIST } from '../../../data/fixtures/engineCards';
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
  VEDALKEN_MESMERIST,
  'Whenever this creature attacks, target creature an opponent controls gets -2/-0 until end of turn.',
);

export const VEDALKEN_MESMERIST_SCRIPT: CardScript = {
  oracleId: VEDALKEN_MESMERIST.oracleId,
  name: VEDALKEN_MESMERIST.name,
  triggers: [
    {
      abilityId: 'attacks-debuff',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Vedalken Mesmerist — target creature gets -2/-0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
