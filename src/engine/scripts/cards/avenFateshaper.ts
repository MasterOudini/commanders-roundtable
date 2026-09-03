// `Aven Fateshaper` — Flying is the engine's; on entry, and again for
// {4}{U}, look at the top four cards of my library and put them back in any
// order.

import { AVEN_FATESHAPER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  AVEN_FATESHAPER,
  'Flying\nWhen this creature enters, look at the top four cards of your library, then put them back in any order.\n{4}{U}: Look at the top four cards of your library, then put them back in any order.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const AGAIN = PRINTED.split('\n')[2] as string;

function lookAtFour(ctx: ScriptCtx, controller: string, label: string): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const count = Math.min(4, library.length);
  if (count === 0) return [];
  const top = library.slice(library.length - count);
  const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [controller] }];
  if (count > 1) {
    events.push({
      t: 'AwaitingSet',
      awaiting: { kind: 'orderCards', player: controller, zone: 'library', destination: 'top', count, label },
    });
  }
  return events;
}

export const AVEN_FATESHAPER_SCRIPT: CardScript = {
  oracleId: AVEN_FATESHAPER.oracleId,
  name: AVEN_FATESHAPER.name,
  triggers: [
    {
      abilityId: 'enters-look',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Aven Fateshaper — look at the top four, put them back in any order',
      resolve: (ctx, _self, obj): readonly EventBody[] => lookAtFour(ctx, obj.controller, obj.label),
    },
  ],
  activated: [
    {
      ref: `${AVEN_FATESHAPER.oracleId}#a0`,
      text: AGAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => lookAtFour(ctx, obj.controller, obj.label),
    },
  ],
};
