// `Invoke the Winds` — I gain control of the artifact or creature, and
// it stands up: the gift pointed at MYSELF (Donate's event, my id).
// D220.

import { INVOKE_THE_WINDS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INVOKE_THE_WINDS, 'Gain control of target artifact or creature. Untap it.');

export const INVOKE_THE_WINDS_SCRIPT: CardScript = {
  oracleId: INVOKE_THE_WINDS.oracleId,
  name: INVOKE_THE_WINDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (card.controller !== obj.controller) {
        events.push({ t: 'ControlChanged', card: target.id, controller: obj.controller });
      }
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      return events;
    },
  },
};
