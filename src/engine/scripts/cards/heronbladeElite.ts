// `Heronblade Elite` - a anotherCreatureEnters trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERONBLADE_ELITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERONBLADE_ELITE, "Vigilance\nWhenever another Human you control enters, put a +1/+1 counter on this creature.\n{T}: Add X mana of any one color, where X is this creature's power.");
const LINES = PRINTED.split('\n');

export const HERONBLADE_ELITE_SCRIPT: CardScript = {
  oracleId: HERONBLADE_ELITE.oracleId,
  name: HERONBLADE_ELITE.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Human'),
        ),
      label: () => "Heronblade Elite - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
