// `Colossus of Sardia` - a static noUntap, an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COLOSSUS_OF_SARDIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COLOSSUS_OF_SARDIA, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nThis creature doesn't untap during your untap step.\n{9}: Untap this creature. Activate only during your upkeep.");
const LINES = PRINTED.split('\n');

export const COLOSSUS_OF_SARDIA_SCRIPT: CardScript = {
  oracleId: COLOSSUS_OF_SARDIA.oracleId,
  name: COLOSSUS_OF_SARDIA.name,
  activated: [
    {
      ref: `${COLOSSUS_OF_SARDIA.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D342).
      applies: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && ev.cards.includes(self),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'PermanentsUntapped') return [ev];
        const cards = ev.cards.filter((c) => c !== self);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
