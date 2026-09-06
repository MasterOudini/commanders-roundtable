// `Barging Sergeant` - a attacks trigger counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARGING_SERGEANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARGING_SERGEANT, "Haste\nMentor (Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.)");
const LINES = PRINTED.split('\n');

export const BARGING_SERGEANT_SCRIPT: CardScript = {
  oracleId: BARGING_SERGEANT.oracleId,
  name: BARGING_SERGEANT.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses("Put a +1/+1 counter on target attacking creature with lesser power."),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Barging Sergeant - counterOnTarget",
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
