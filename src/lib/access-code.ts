import { randomInt } from "node:crypto";

// Alfabeto sem os caracteres ambíguos quando o código é lido em voz alta ou
// copiado à mão: 0/O e 1/I/L ficam de fora. 31 símbolos ^ 12 posições dão
// ~7,9x10^17 combinações — colisão é desprezível, e a @unique em Person.accessCode
// é a rede de segurança caso aconteça.
export const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ACCESS_CODE_LENGTH = 12;

// randomInt (e não randomBytes()[i] % 31) porque 256 não é múltiplo de 31 —
// o módulo enviesaria as primeiras letras do alfabeto.
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return code;
}
