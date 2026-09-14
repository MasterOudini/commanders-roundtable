// `Disciple of the Ring` - an activation vocab, an activation pumping itself, an activation tapTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISCIPLE_OF_THE_RING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(DISCIPLE_OF_THE_RING, "{1}, Exile an instant or sorcery card from your graveyard: Choose one —\n• Counter target noncreature spell unless its controller pays {2}.\n• This creature gets +1/+1 until end of turn.\n• Tap target creature.\n• Untap target creature.");
const LINES = PRINTED.split('\n');

const MODES_A0 = [
  { text: "Counter target noncreature spell unless its controller pays {2}.", targets: vocabularyTargets("Counter target noncreature spell unless its controller pays {2}.") },
  { text: "This creature gets +1/+1 until end of turn.", targets: vocabularyTargets("~ gets +1/+1 until end of turn.") },
  { text: "Tap target creature.", targets: vocabularyTargets("Tap target creature.") },
  { text: "Untap target creature.", targets: vocabularyTargets("Untap target creature.") },
];

const VOCAB_A0_m0 = vocabularyEffects("Counter target noncreature spell unless its controller pays {2}.", DISCIPLE_OF_THE_RING.name);
const VOCAB_T_A0_m0 = vocabularyTargets("Counter target noncreature spell unless its controller pays {2}.");
const VOCAB_A0_m3 = vocabularyEffects("Untap target creature.", DISCIPLE_OF_THE_RING.name);
const VOCAB_T_A0_m3 = vocabularyTargets("Untap target creature.");

export const DISCIPLE_OF_THE_RING_SCRIPT: CardScript = {
  oracleId: DISCIPLE_OF_THE_RING.oracleId,
  name: DISCIPLE_OF_THE_RING.name,
  activated: [
    {
      ref: `${DISCIPLE_OF_THE_RING.oracleId}#a0`,
      text: LINES[0] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_A0_m0, VOCAB_T_A0_m0);
        }
        if (chosen === 1) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
        }
        if (chosen === 2) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
          return [{ t: 'PermanentsTapped', cards: [target.id] }];
        }
        if (chosen === 3) {
          return ctx.vocabulary(obj, VOCAB_A0_m3, VOCAB_T_A0_m3);
        }
        return [];
      },
    },
  ],
};
