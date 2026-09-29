// `Migloz, Maze Crusher` - a static entersWithCounters, an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIGLOZ_MAZE_CRUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIGLOZ_MAZE_CRUSHER, "Migloz enters with five oil counters on it.\n{1}, Remove an oil counter from Migloz: It gains vigilance and menace until end of turn.\n{2}, Remove two oil counters from Migloz: It gets +2/+2 until end of turn.\n{3}, Remove three oil counters from Migloz: Destroy target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It gains vigilance and menace until end of turn.", MIGLOZ_MAZE_CRUSHER.name);
const VOCAB_T_A0 = vocabularyTargets("It gains vigilance and menace until end of turn.");
const VOCAB_A1 = vocabularyEffects("It gets +2/+2 until end of turn.", MIGLOZ_MAZE_CRUSHER.name);
const VOCAB_T_A1 = vocabularyTargets("It gets +2/+2 until end of turn.");
const VOCAB_A2 = vocabularyEffects("Destroy target artifact or enchantment.", MIGLOZ_MAZE_CRUSHER.name);
const VOCAB_T_A2 = vocabularyTargets("Destroy target artifact or enchantment.");

export const MIGLOZ_MAZE_CRUSHER_SCRIPT: CardScript = {
  oracleId: MIGLOZ_MAZE_CRUSHER.oracleId,
  name: MIGLOZ_MAZE_CRUSHER.name,
  activated: [
    {
      ref: `${MIGLOZ_MAZE_CRUSHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MIGLOZ_MAZE_CRUSHER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${MIGLOZ_MAZE_CRUSHER.oracleId}#a2`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 5 }] }],
    },
  ],
};
