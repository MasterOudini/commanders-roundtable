// `Rank Officer` - a etb trigger vocab, an activation loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RANK_OFFICER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RANK_OFFICER, "When this creature enters, you may discard a card. If you do, create a 2/2 black Zombie creature token.\n{1}{B}, {T}, Exile a creature card from your graveyard: Each opponent loses 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, create a 2/2 black Zombie creature token.", RANK_OFFICER.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, create a 2/2 black Zombie creature token.");

export const RANK_OFFICER_SCRIPT: CardScript = {
  oracleId: RANK_OFFICER.oracleId,
  name: RANK_OFFICER.name,
  activated: [
    {
      ref: `${RANK_OFFICER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        return out;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rank Officer - You may discard a card. If you do, create a 2/2 black Zombie creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
