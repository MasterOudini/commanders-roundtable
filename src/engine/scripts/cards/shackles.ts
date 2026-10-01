// `Shackles` - a static attachedNoUntap, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHACKLES } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SHACKLES, "Enchant creature\nEnchanted creature doesn't untap during its controller's untap step.\n{W}: Return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return this Aura to its owner's hand.", SHACKLES.name);
const VOCAB_T_A0 = vocabularyTargets("Return this Aura to its owner's hand.");

export const SHACKLES_SCRIPT: CardScript = {
  oracleId: SHACKLES.oracleId,
  name: SHACKLES.name,
  activated: [
    {
      ref: `${SHACKLES.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D371).
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
