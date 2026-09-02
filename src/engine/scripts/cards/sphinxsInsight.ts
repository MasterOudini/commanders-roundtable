// `Sphinx's Insight` — "Draw two cards.\nAddendum — If you cast this spell
// during your main phase, you gain 2 life." Arrester's Admonition's
// Addendum (D272): a phase cannot end while the stack is non-empty (CR
// 500.2), so "cast during your main phase" is exactly "resolving while I am
// the active player in a main phase". D281.

import { SPHINX_S_INSIGHT } from '../../../data/fixtures/engineCards';
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
  SPHINX_S_INSIGHT,
  'Draw two cards.\nAddendum — If you cast this spell during your main phase, you gain 2 life.',
);

export const SPHINXS_INSIGHT_SCRIPT: CardScript = {
  oracleId: SPHINX_S_INSIGHT.oracleId,
  name: SPHINX_S_INSIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 2)];
      const turn = ctx.state.turn;
      const myMainPhase =
        turn.activePlayer === obj.controller &&
        (turn.phase === 'precombatMain' || turn.phase === 'postcombatMain');
      const me = ctx.state.players[obj.controller];
      if (myMainPhase && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
