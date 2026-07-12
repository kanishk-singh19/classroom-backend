import { desc, eq, ilike, or } from 'drizzle-orm';
import express from 'express';
import { departments } from '../db/schema';
import { db } from '../db';
import { isUniqueViolation, isForeignKeyViolation } from '../lib/db-errors';
import { requireAuth, requireRole } from '../middleware/auth';

// Only staff can modify catalog data.
const canManage = [requireAuth, requireRole('admin', 'teacher')];

const router = express.Router();

// get all departments with optional search
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { search, page = 1, limit = 100 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const whereClause = search
            ? or(
                  ilike(departments.name, `%${search}%`),
                  ilike(departments.code, `%${search}%`)
              )
            : undefined;

        const list = await db
            .select()
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: list,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: list.length,
                totalPages: Math.ceil(list.length / limitPerPage),
            },
        });
    } catch (e) {
        console.error(`GET /departments error ${e}`);
        res.status(500).json({ error: 'failed to get departments' });
    }
});

// get a single department
router.get('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid department id' });
        }

        const [department] = await db
            .select()
            .from(departments)
            .where(eq(departments.id, id))
            .limit(1);

        if (!department) {
            return res.status(404).json({ error: 'department not found' });
        }

        res.status(200).json({ data: department });
    } catch (e) {
        console.error(`GET /departments/:id error ${e}`);
        res.status(500).json({ error: 'failed to get department' });
    }
});

// create a department
router.post('/', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const { code, name, description } = req.body ?? {};

        if (!code || !name) {
            return res.status(400).json({ error: 'code and name are required' });
        }

        const [created] = await db
            .insert(departments)
            .values({ code, name, description: description ?? null })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'a department with this code already exists' });
        }
        console.error(`POST /departments error ${e}`);
        res.status(500).json({ error: 'failed to create department' });
    }
});

// update a department
router.put('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid department id' });
        }

        const { code, name, description } = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (code !== undefined) updates.code = code;
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(departments)
            .set(updates)
            .where(eq(departments.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'department not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'a department with this code already exists' });
        }
        console.error(`PUT /departments/:id error ${e}`);
        res.status(500).json({ error: 'failed to update department' });
    }
});

// delete a department (blocked if subjects still reference it)
router.delete('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid department id' });
        }

        const [deleted] = await db
            .delete(departments)
            .where(eq(departments.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'department not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e: any) {
        if (isForeignKeyViolation(e)) {
            return res
                .status(409)
                .json({ error: 'cannot delete a department that still has subjects' });
        }
        console.error(`DELETE /departments/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete department' });
    }
});

export default router;
