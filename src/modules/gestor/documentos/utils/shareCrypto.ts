const sha256Fallback = (ascii: string): string => {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let result = '';

  const asciiLength = ascii[lengthProperty] * 8;
  
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const HASH = hash.slice();
  
  const blocks: number[] = [];
  for (let idx = 0; idx < ascii.length; idx++) {
    blocks[idx >> 2] |= (ascii.charCodeAt(idx) & 0xff) << (24 - (idx % 4) * 8);
  }
  
  const totalBytes = ascii.length;
  const paddingBytes = 64 - ((totalBytes + 8) % 64);
  const totalLength = totalBytes + paddingBytes + 8;
  
  const paddedBlocks: number[] = new Array(totalLength / 4).fill(0);
  for (let idx = 0; idx < blocks.length; idx++) {
    paddedBlocks[idx] = blocks[idx];
  }
  paddedBlocks[totalBytes >> 2] |= 0x80 << (24 - (totalBytes % 4) * 8);
  
  const lastIndex = paddedBlocks.length - 1;
  paddedBlocks[lastIndex] = asciiLength & 0xffffffff;
  paddedBlocks[lastIndex - 1] = (asciiLength / maxWord) & 0xffffffff;

  for (let offset = 0; offset < paddedBlocks.length; offset += 16) {
    const w: number[] = new Array(64).fill(0);
    for (let idx = 0; idx < 16; idx++) {
      w[idx] = paddedBlocks[offset + idx];
    }
    for (let idx = 16; idx < 64; idx++) {
      const s0 = ((w[idx - 15] >>> 7) | (w[idx - 15] << 25)) ^ ((w[idx - 15] >>> 18) | (w[idx - 15] << 14)) ^ (w[idx - 15] >>> 3);
      const s1 = ((w[idx - 2] >>> 17) | (w[idx - 2] << 15)) ^ ((w[idx - 2] >>> 19) | (w[idx - 2] << 13)) ^ (w[idx - 2] >>> 10);
      w[idx] = (w[idx - 16] + s0 + w[idx - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = HASH;

    for (let idx = 0; idx < 64; idx++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[idx] + w[idx]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    HASH[0] = (HASH[0] + a) | 0;
    HASH[1] = (HASH[1] + b) | 0;
    HASH[2] = (HASH[2] + c) | 0;
    HASH[3] = (HASH[3] + d) | 0;
    HASH[4] = (HASH[4] + e) | 0;
    HASH[5] = (HASH[5] + f) | 0;
    HASH[6] = (HASH[6] + g) | 0;
    HASH[7] = (HASH[7] + h) | 0;
  }

  for (let idx = 0; idx < 8; idx++) {
    result += (HASH[idx] >>> 0).toString(16).padStart(8, '0');
  }
  
  return result;
};

export const hashSharePassword = async (password: string): Promise<string> => {
  const trimmed = password.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const data = new TextEncoder().encode(trimmed);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.warn('[hashSharePassword] Falha ao usar crypto.subtle.digest. Usando fallback puro JS.', err);
    }
  }
  return sha256Fallback(trimmed);
};
