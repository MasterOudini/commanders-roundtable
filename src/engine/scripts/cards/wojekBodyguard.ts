// `Wojek Bodyguard` - a attacks trigger counterOnTarget, a static cantAttackOrBlockAlone
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOJEK_BODYGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WOJEK_BODYGUARD, "Mentor (Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.)\nThis creature can't attack or block alone.");
const LINES = PRINTED.split('\n');

export const WOJEK_BODYGUARD_SCRIPT: CardScript = {
  oracleId: WOJEK_BODYGUARD.oracleId,
  name: WOJEK_BODYGUARD.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses("Put a +1/+1 counter on target attacking creature with lesser power."),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Wojek Bodyguard - counterOnTarget",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantAttackOrBlockAlone-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttackAlone: (_ctx, self, candidate) => candidate !== self,
      canBlockAlone: (_ctx, self, candidate) => candidate !== self,
    },
  ],
};
