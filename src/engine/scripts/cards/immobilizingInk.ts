// `Immobilizing Ink` - a static attachedNoUntap, a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMMOBILIZING_INK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(IMMOBILIZING_INK, "Enchant creature\nEnchanted creature doesn't untap during its controller's untap step.\nEnchanted creature has \"{1}, Discard a card: Untap this creature.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G2 = vocabularyEffects("Untap this creature.", IMMOBILIZING_INK.name);
const VOCAB_T_G2 = vocabularyTargets("Untap this creature.");

const GRANT_2 = grantedActivated("{1}, Discard a card: Untap this creature.", `${IMMOBILIZING_INK.oracleId}#g2`, IMMOBILIZING_INK.name);

export const IMMOBILIZING_INK_SCRIPT: CardScript = {
  oracleId: IMMOBILIZING_INK.oracleId,
  name: IMMOBILIZING_INK.name,
  activated: [
    {
      ref: GRANT_2.ref,
      text: LINES[2] as string,
      granted: GRANT_2.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G2, VOCAB_T_G2);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D371).
      applies: (ctx, self, ev) => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        return host !== null && ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.state.cards[host]?.controller && ev.cards.includes(host);
      },
      replace: (ctx, self, ev): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (ev.t !== 'PermanentsUntapped' || host === null) return [ev];
        const cards = ev.cards.filter((c) => c !== host);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_2.ref, ability: GRANT_2.ability });
      },
    },
  ],
};
