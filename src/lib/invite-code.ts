// Generates a short, human-friendly invite code like "AB3K7Q2M".
// Avoids ambiguous characters (0/O, 1/I) so codes are easy to read and share.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8): string {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
}
