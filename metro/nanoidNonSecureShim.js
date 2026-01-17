// Lightweight nanoid clone for environments where the real module fails to load (SSR / Metro route extraction).
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';

function randomChar() {
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

export function nanoid(size = 21) {
  let id = '';
  for (let i = 0; i < size; i += 1) {
    id += randomChar();
  }
  return id;
}

export function customAlphabet(customAlphabet, size = 21) {
  const chars = Array.from(customAlphabet);
  return () => {
    let id = '';
    for (let i = 0; i < size; i += 1) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  };
}

export default { nanoid, customAlphabet };
