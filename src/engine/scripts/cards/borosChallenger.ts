// `Boros Challenger` - a attacks trigger counterOnTarget, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOROS_CHALLENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOROS_CHALLENGER, "Mentor (Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.)\n{2}{R}{W}: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const BOROS_CHALLENGER_SCRIPT: CardScript = {
  oracleId: BOROS_CHALLENGER.oracleId,
  name: BOROS_CHALLENGER.name,
  activated: [
    {
      ref: `${BOROS_CHALLENGER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses("Put a +1/+1 counter on target attacking creature with lesser power."),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Boros Challenger - counterOnTarget",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
