// `Battlesong Berserker` — "Whenever you attack, target creature you control
// gets +1/+0 and gains menace until end of turn." "You attack" is YOUR
// declaration: every attacker in one AttackersDeclared belongs to the
// declaring player, so any-of-mine IS the filter (Mavren's read minus the
// subtype). The trigger targets (D147) with the D194 rider. D199.

import { BATTLESONG_BERSERKER } from '../../../data/fixtures/engineCards';
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
  BATTLESONG_BERSERKER,
  "Whenever you attack, target creature you control gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)",
);

export const BATTLESONG_BERSERKER_SCRIPT: CardScript = {
  oracleId: BATTLESONG_BERSERKER.oracleId,
  name: BATTLESONG_BERSERKER.name,
  triggers: [
    {
      abilityId: 'you-attack',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => ctx.query.controllerOf(a.card) === ctx.query.controllerOf(self)),
      label: () => 'Battlesong Berserker — +1/+0 and menace',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 0,
            keywords: ['menace'],
          },
        ];
      },
    },
  ],
};
