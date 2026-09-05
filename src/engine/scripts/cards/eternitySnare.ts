// `Eternity Snare` - a etb trigger draw, a static attachedNoUntap
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETERNITY_SNARE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(ETERNITY_SNARE, "Enchant creature\nWhen this Aura enters, draw a card.\nEnchanted creature doesn't untap during its controller's untap step.");
const LINES = PRINTED.split('\n');

export const ETERNITY_SNARE_SCRIPT: CardScript = {
  oracleId: ETERNITY_SNARE.oracleId,
  name: ETERNITY_SNARE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eternity Snare - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
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
