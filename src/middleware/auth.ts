import express from 'express';
import { verifyToken, TokenPayload } from '../lib/auth';

// Augment Express' Request so downstream handlers can read the auth payload.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            auth?: TokenPayload;
        }
    }
}

// Reads a Bearer token, verifies it, and attaches the payload to req.auth.
export function requireAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'authentication required' });
    }

    const token = header.slice('Bearer '.length).trim();
    try {
        req.auth = verifyToken(token);
        next();
    } catch {
        return res.status(401).json({ error: 'invalid or expired token' });
    }
}
