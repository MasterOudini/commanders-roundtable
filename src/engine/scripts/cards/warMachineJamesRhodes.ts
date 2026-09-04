// `War Machine, James Rhodes` - tap on "tap up to one target creature", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { WAR_MACHINE_JAMES_RHODES } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(WAR_MACHINE_JAMES_RHODES, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever War Machine attacks, tap up to one target creature.");
const TEXT = PRINTED.split('\n')[1] as string;

export const WAR_MACHINE_JAMES_RHODES_SCRIPT: CardScript = {
  oracleId: WAR_MACHINE_JAMES_RHODES.oracleId,
  name: WAR_MACHINE_JAMES_RHODES.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "War Machine, James Rhodes - tap up to one target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          if (!card.tapped) out.push({ t: 'PermanentsTapped', cards: [target.id] });
        }
        return out;
      },
    },
  ],
};
