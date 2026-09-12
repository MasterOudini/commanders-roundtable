// `Prison Realm` - a etb trigger vocab, a etb trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRISON_REALM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRISON_REALM, "When this enchantment enters, exile target creature or planeswalker an opponent controls until this enchantment leaves the battlefield.\nWhen this enchantment enters, scry 1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target creature or planeswalker an opponent controls until this enchantment leaves the battlefield.", PRISON_REALM.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature or planeswalker an opponent controls until this enchantment leaves the battlefield.");

export const PRISON_REALM_SCRIPT: CardScript = {
  oracleId: PRISON_REALM.oracleId,
  name: PRISON_REALM.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Prison Realm - Exile target creature or planeswalker an opponent controls until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Prison Realm - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Prison Realm - scry 1" } },
        ];
      },
    },
  ],
};
