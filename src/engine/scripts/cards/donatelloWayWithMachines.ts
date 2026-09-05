// `Donatello, Way with Machines` - a artifactEnters trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DONATELLO_WAY_WITH_MACHINES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DONATELLO_WAY_WITH_MACHINES, "Flying\nWhenever an artifact you control enters, put a +1/+1 counter on Donatello.");
const LINES = PRINTED.split('\n');

export const DONATELLO_WAY_WITH_MACHINES_SCRIPT: CardScript = {
  oracleId: DONATELLO_WAY_WITH_MACHINES.oracleId,
  name: DONATELLO_WAY_WITH_MACHINES.name,
  triggers: [
    {
      abilityId: 'artifactEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Donatello, Way with Machines - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
