// `Ant-Man's Air Force` - pump on "up to one target creature gets -1/-0 until end of turn", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { ANT_MAN_S_AIR_FORCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANT_MAN_S_AIR_FORCE, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever this creature attacks, up to one target creature gets -1/-0 until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const ANT_MANS_AIR_FORCE_SCRIPT: CardScript = {
  oracleId: ANT_MAN_S_AIR_FORCE.oracleId,
  name: ANT_MAN_S_AIR_FORCE.name,
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
      label: () => "Ant-Man's Air Force - up to one target creature gets -1/-0 until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
