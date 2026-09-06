// `Blue Marvel, Adam Brashear` - a secondCard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLUE_MARVEL_ADAM_BRASHEAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLUE_MARVEL_ADAM_BRASHEAR, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWard {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nWhenever you draw your second card each turn, put a +1/+1 counter on Blue Marvel.");
const LINES = PRINTED.split('\n');

export const BLUE_MARVEL_ADAM_BRASHEAR_SCRIPT: CardScript = {
  oracleId: BLUE_MARVEL_ADAM_BRASHEAR.oracleId,
  name: BLUE_MARVEL_ADAM_BRASHEAR.name,
  triggers: [
    {
      abilityId: 'secondCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Blue Marvel, Adam Brashear - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
