import type { Losuj } from "../../src/lib/auth-klient";

/**
 * Generator z ustalonym ziarnem (xorshift32) WYŁĄCZNIE do testów (CLAUDE.md, zasada 5):
 * deterministyczne bajty zamiast ręcznie wpisanych tokenów i PIN-ów. Nigdy w kodzie produkcyjnym.
 */
export function losujZZiarnem(ziarno: number): Losuj {
  let stan = ziarno >>> 0 || 1;
  return (n: number) => {
    const bajty = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      stan ^= stan << 13;
      stan >>>= 0;
      stan ^= stan >>> 17;
      stan ^= stan << 5;
      stan >>>= 0;
      bajty[i] = stan & 0xff;
    }
    return bajty;
  };
}
