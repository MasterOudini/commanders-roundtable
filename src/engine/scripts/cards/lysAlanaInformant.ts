// `Lys Alana Informant` — "enters or dies, surveil 1": one printed
// line, two defs, the dies half looking back (Ashen Rider's pair with
// the surveil ask as the shared payload). D223.

import { LYS_ALANA_INFORMANT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { StackObject } from '../../types/state';

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
  LYS_ALANA_INFORMANT,
  'When this creature enters or dies, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);

function surveilOne(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
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
}

export const LYS_ALANA_INFORMANT_SCRIPT: CardScript = {
  oracleId: LYS_ALANA_INFORMANT.oracleId,
  name: LYS_ALANA_INFORMANT.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Lys Alana Informant — surveil 1',
      resolve: surveilOne,
    },
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
      label: () => 'Lys Alana Informant — surveil 1',
      resolve: surveilOne,
    },
  ],
};
