import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { hashPassword, comparePassword, signToken } from '../lib/auth';
import { requireAuth } from '../middleware/auth';
import { isUniqueViolation } from '../lib/db-errors';

const router = express.Router();

const ROLES = ['student', 'teacher', 'admin'] as const;
type Role = (typeof ROLES)[number];

// Strip the password before returning a user to the client.
function publicUser(user: typeof users.$inferSelect) {
    const { password, ...rest } = user;
    return rest;
}

// register a new user
router.post('/signup', async (req: express.Request, res: express.Response) => {
    try {
        const { name, email, password, role, department } = req.body ?? {};

        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'password must be at least 6 characters' });
        }

        const safeRole: Role = ROLES.includes(role) ? role : 'student';
        // Fall back to the email's local part when no name is provided.
        const safeName = name?.trim() || String(email).split('@')[0];

        const hashed = await hashPassword(password);

        const [created] = await db
            .insert(users)
            .values({
                name: safeName,
                email,
                password: hashed,
                role: safeRole,
                department: department ?? null,
            })
            .returning();

        if (!created) {
            return res.status(500).json({ error: 'failed to create account' });
        }

        const token = signToken({ sub: created.id, email: created.email, role: created.role });

        res.status(201).json({ data: { token, user: publicUser(created) } });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'an account with this email already exists' });
        }
        console.error(`POST /auth/signup error ${e}`);
        res.status(500).json({ error: 'failed to create account' });
    }
});

// log in an existing user
router.post('/login', async (req: express.Request, res: express.Response) => {
    try {
        const { email, password } = req.body ?? {};

        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ error: 'invalid email or password' });
        }

        const token = signToken({ sub: user.id, email: user.email, role: user.role });

        res.status(200).json({ data: { token, user: publicUser(user) } });
    } catch (e) {
        console.error(`POST /auth/login error ${e}`);
        res.status(500).json({ error: 'failed to log in' });
    }
});

// return the currently authenticated user
router.get('/me', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const id = req.auth!.sub;

        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.status(200).json({ data: publicUser(user) });
    } catch (e) {
        console.error(`GET /auth/me error ${e}`);
        res.status(500).json({ error: 'failed to load user' });
    }
});

export default router;
