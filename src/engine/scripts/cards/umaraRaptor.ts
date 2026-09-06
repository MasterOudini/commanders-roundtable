// `Umara Raptor` - a selfOrAnotherAllyEnters trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UMARA_RAPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UMARA_RAPTOR, "Flying\nWhenever this creature or another Ally you control enters, you may put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const UMARA_RAPTOR_SCRIPT: CardScript = {
  oracleId: UMARA_RAPTOR.oracleId,
  name: UMARA_RAPTOR.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherAllyEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.subtypes.includes('Ally')),
        ),
      label: () => "Umara Raptor - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
