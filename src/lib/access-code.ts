import { randomInt } from "node:crypto";

// Alphabet without the characters that get confused when a code is read aloud
// or copied by hand: 0/O and 1/I/L are left out. 31 symbols ^ 12 positions give
// ~7.9x10^17 combinations, so a collision is negligible — and the @unique on
// Person.accessCode is the safety net if one ever happens.
export const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ACCESS_CODE_LENGTH = 12;

// randomInt, not randomBytes()[i] % 31: 256 isn't a multiple of 31, so the
// modulo would bias the alphabet's first letters.
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return code;
}
