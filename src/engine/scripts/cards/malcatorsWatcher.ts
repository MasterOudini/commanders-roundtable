// `Malcator's Watcher` — "When this creature dies, draw a card." M6.4ac,
// D185.

import { MALCATOR_S_WATCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  MALCATOR_S_WATCHER,
  'Flying, vigilance\nWhen this creature dies, draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MALCATORS_WATCHER_SCRIPT: CardScript = {
  oracleId: MALCATOR_S_WATCHER.oracleId,
  name: MALCATOR_S_WATCHER.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => "Malcator's Watcher — draw a card",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
