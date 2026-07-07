import { desc, and, eq, ilike, or, sql } from 'drizzle-orm';
import express from 'express';
import { users } from '../db/schema';
import { db } from '../db';
import { hashPassword } from '../lib/auth';
import { requireAuth } from '../middleware/auth';
import { isUniqueViolation } from '../lib/db-errors';

const router = express.Router();

const ROLES = ['student', 'teacher', 'admin'] as const;
type Role = (typeof ROLES)[number];

// Never leak the password hash to clients.
const publicColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    department: users.department,
    image: users.image,
    imageCldPubId: users.imageCldPubId,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
};

// list users, filterable by role / search / department
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { role, search, department, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const conditions = [];
        if (role) conditions.push(eq(users.role, role as Role));
        if (department) conditions.push(ilike(users.department, `%${department}%`));
        if (search) {
            conditions.push(
                or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
            );
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(whereClause);
        const totalCount = countResult[0]?.count ?? 0;

        const list = await db
            .select(publicColumns)
            .from(users)
            .where(whereClause)
            .orderBy(desc(users.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: list,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (e) {
        console.error(`GET /users error ${e}`);
        res.status(500).json({ error: 'failed to get users' });
    }
});

// get a single user
router.get('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid user id' });
        }

        const [user] = await db
            .select(publicColumns)
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.status(200).json({ data: user });
    } catch (e) {
        console.error(`GET /users/:id error ${e}`);
        res.status(500).json({ error: 'failed to get user' });
    }
});

// create a user (admin adds faculty/students). Password is optional here — a
// default temp password is used when the admin doesn't supply one.
router.post('/', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const { name, email, role, department, image, imageCldPubId, password } = req.body ?? {};

        if (!name || !email) {
            return res.status(400).json({ error: 'name and email are required' });
        }

        const safeRole: Role = ROLES.includes(role) ? role : 'student';
        const hashed = await hashPassword(password && String(password).length >= 6 ? password : 'password123');

        const [created] = await db
            .insert(users)
            .values({
                name,
                email,
                password: hashed,
                role: safeRole,
                department: department ?? null,
                image: image ?? null,
                imageCldPubId: imageCldPubId ?? null,
            })
            .returning(publicColumns);

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'a user with this email already exists' });
        }
        console.error(`POST /users error ${e}`);
        res.status(500).json({ error: 'failed to create user' });
    }
});

// update a user
router.put('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid user id' });
        }

        const { name, email, role, department, image, imageCldPubId, password } = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (role !== undefined && ROLES.includes(role)) updates.role = role;
        if (department !== undefined) updates.department = department;
        if (image !== undefined) updates.image = image;
        if (imageCldPubId !== undefined) updates.imageCldPubId = imageCldPubId;
        if (password && String(password).length >= 6) {
            updates.password = await hashPassword(password);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, id))
            .returning(publicColumns);

        if (!updated) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'a user with this email already exists' });
        }
        console.error(`PUT /users/:id error ${e}`);
        res.status(500).json({ error: 'failed to update user' });
    }
});

// delete a user
router.delete('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid user id' });
        }

        const [deleted] = await db
            .delete(users)
            .where(eq(users.id, id))
            .returning(publicColumns);

        if (!deleted) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /users/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete user' });
    }
});

export default router;
