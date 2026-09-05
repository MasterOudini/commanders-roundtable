// `Bonds of Quicksilver` - a static attachedNoUntap
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BONDS_OF_QUICKSILVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BONDS_OF_QUICKSILVER, "Flash (You may cast this spell any time you could cast an instant.)\nEnchant creature\nEnchanted creature doesn't untap during its controller's untap step.");
const LINES = PRINTED.split('\n');

export const BONDS_OF_QUICKSILVER_SCRIPT: CardScript = {
  oracleId: BONDS_OF_QUICKSILVER.oracleId,
  name: BONDS_OF_QUICKSILVER.name,
  replacements: [
    {
      abilityId: 'no-untap-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D323).
      applies: (ctx, self, ev) => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        return host !== null && ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.state.cards[host]?.controller && ev.cards.includes(host);
      },
      replace: (ctx, self, ev): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (ev.t !== 'PermanentsUntapped' || host === null) return [ev];
        const cards = ev.cards.filter((c) => c !== host);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
