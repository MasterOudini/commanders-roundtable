// `Gerrard's Command` — "Untap target creature. It gets +3/+3 until end of
// turn." D215.

import { GERRARD_S_COMMAND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GERRARD_S_COMMAND, 'Untap target creature. It gets +3/+3 until end of turn.');

export const GERRARDS_COMMAND_SCRIPT: CardScript = {
  oracleId: GERRARD_S_COMMAND.oracleId,
  name: GERRARD_S_COMMAND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 3, toughness: 3 });
      return events;
    },
  },
};
