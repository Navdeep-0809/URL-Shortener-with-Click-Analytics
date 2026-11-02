import { customAlphabet } from "nanoid";

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const SHORT_CODE_LENGTH = 7;

export const generateShortCode = customAlphabet(BASE62_ALPHABET, SHORT_CODE_LENGTH);
