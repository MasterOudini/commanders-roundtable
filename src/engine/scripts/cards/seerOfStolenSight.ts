// `Seer of Stolen Sight` — "Menace / Whenever one or more artifacts
// and/or creatures you control are put into a graveyard from the
// battlefield, surveil 1." The per-EVENT batch IS the printed "one or
// more" (Deeproot's argument); the dead are typed on the BEFORE state.
// D245.

import { SEER_OF_STOLEN_SIGHT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  SEER_OF_STOLEN_SIGHT,
  "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever one or more artifacts and/or creatures you control are put into a graveyard from the battlefield, surveil 1. " +
    '(Look at the top card of your library. You may put that card into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

function qualifies(ctx: ScriptCtx, self: InstanceId, dead: InstanceId): boolean {
  const inst = ctx.state.cards[dead];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const types = ctx.derive(dead).typeLine.types;
  return types.includes('Artifact') || types.includes('Creature');
}

export const SEER_OF_STOLEN_SIGHT_SCRIPT: CardScript = {
  oracleId: SEER_OF_STOLEN_SIGHT.oracleId,
  name: SEER_OF_STOLEN_SIGHT.name,
  triggers: [
    {
      abilityId: 'dies-surveil',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Seer of Stolen Sight — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
