// `Wistful Thinking` — "Target player draws two cards, then discards four
// cards."
//
// ⚠️ THE DISCARD IS A COUNT, NOT A HAND, so it must be CHOSEN — and that ask
// is script-raisable: `chooseFromZone` is raised straight out of a spell
// resolve by Laquatus's Creativity (D221), Mind Burst, Rakdos's Return,
// Ravenous Rats and Rottenheart Ghoul. Classifying this batch is what
// established that half of the 75-entry `script-raised prompt` ledger class
// is already reachable; the other half (a COLOUR or TYPE choice) is not,
// because `chooseColor` is raised only by the engine's entry path.
//
// The ask goes LAST (D195), after the draws, so the player chooses from the
// hand they actually have. D270.

import { WISTFUL_THINKING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  WISTFUL_THINKING,
  'Target player draws two cards, then discards four cards.',
);

export const WISTFUL_THINKING_SCRIPT: CardScript = {
  oracleId: WISTFUL_THINKING.oracleId,
  name: WISTFUL_THINKING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];

      const events: EventBody[] = [...drawEvents(ctx.state, target.id, 2)];

      // ⚠️ The hand they will have AFTER the two draws — the state here is
      // pre-resolution, so the count has to be reasoned, not read.
      const before = (ctx.state.zones.hand[target.id] ?? []).length;
      const library = ctx.state.zones.library[target.id] ?? [];
      const after = before + Math.min(2, library.length);
      const n = Math.min(4, after);
      if (n === 0) return events;

      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'chooseFromZone',
          player: target.id,
          zone: 'hand',
          rest: null,
          count: n,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
