// `Armasaur Guide` — "Vigilance\nWhenever you attack with three or more
// creatures, put a +1/+1 counter on target creature you control." The first
// ATTACK-COUNT trigger: it watches `AttackersDeclared` and counts the
// declaration's attackers its controller owns, then targets through the
// trigger machinery (D147) and writes the counter Yotian's way. M6.4e, D162.

import { ARMASAUR_GUIDE } from '../../../data/fixtures/engineCards';
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
  ARMASAUR_GUIDE,
  "Vigilance (Attacking doesn't cause this creature to tap.)\nWhenever you attack with three or more creatures, put a +1/+1 counter on target creature you control.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ARMASAUR_GUIDE_SCRIPT: CardScript = {
  oracleId: ARMASAUR_GUIDE.oracleId,
  name: ARMASAUR_GUIDE.name,
  triggers: [
    {
      abilityId: 'attack',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      // "you attack with three or more" — count the DECLARATION's attackers the
      // Guide's controller owns, not the whole event: the event is one
      // declaration and only the active player declares, but counting through
      // the controller keeps the def honest about whose attack it is.
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        const mine = ctx.query.controllerOf(self);
        let count = 0;
        for (const a of ev.attackers) {
          if (ctx.state.cards[a.card]?.controller === mine) count += 1;
        }
        return count >= 3;
      },
      label: () => 'Armasaur Guide — +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        // Re-checked at resolution (CR 603.2): a counter on a graveyard card
        // is a number nothing reads.
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
