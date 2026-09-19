// `Primaris Chaplain` - a attacks trigger battleCry, a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRIMARIS_CHAPLAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRIMARIS_CHAPLAIN, "Battle cry (Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.)\nRosarius — Whenever this creature attacks, it gains indestructible until end of turn.");
const LINES = PRINTED.split('\n');

export const PRIMARIS_CHAPLAIN_SCRIPT: CardScript = {
  oracleId: PRIMARIS_CHAPLAIN.oracleId,
  name: PRIMARIS_CHAPLAIN.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Primaris Chaplain - battleCry",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Battle cry (CR 702.92): each other attacking creature gets +1/+0 until end of turn.
        return (ctx.state.combat?.attackers ?? []).filter((a) => a.card !== self).map((a) => ({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: 1, toughness: 0 }));
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Primaris Chaplain - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["indestructible"] }];
      },
    },
  ],
};
