// `Night's Whisper` — "You draw two cards and lose 2 life." The first
// SpellDef through `drawEvents` — THE one draw rule (D158), so the two draws
// arrive as one CardsMoved, the D189 `DrewCards` marker fires for exactly
// those two cards, and drawing from an empty library loses the game the way
// every other draw does. D192.

import { NIGHT_S_WHISPER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(NIGHT_S_WHISPER, 'You draw two cards and lose 2 life.');

export const NIGHTS_WHISPER_SCRIPT: CardScript = {
  oracleId: NIGHT_S_WHISPER.oracleId,
  name: NIGHT_S_WHISPER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        ...drawEvents(ctx.state, obj.controller, 2),
        { t: 'LifeChanged', player: obj.controller, delta: -2, to: player.life - 2 },
      ];
    },
  },
};
