import { desc, eq } from 'drizzle-orm';
import express from 'express';
import { assignments } from '../db/schema';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { isForeignKeyViolation } from '../lib/db-errors';

const router = express.Router();

// Only staff manage assignments.
const canManage = [requireAuth, requireRole('admin', 'teacher')];

// list assignments, filtered by class
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { classId, page = 1, limit = 50 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const whereClause = classId ? eq(assignments.classId, +classId) : undefined;

        const list = await db
            .select()
            .from(assignments)
            .where(whereClause)
            .orderBy(desc(assignments.createdAt))
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
        console.error(`GET /assignments error ${e}`);
        res.status(500).json({ error: 'failed to get assignments' });
    }
});

// get a single assignment
router.get('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid assignment id' });
        }

        const [item] = await db
            .select()
            .from(assignments)
            .where(eq(assignments.id, id))
            .limit(1);

        if (!item) {
            return res.status(404).json({ error: 'assignment not found' });
        }

        res.status(200).json({ data: item });
    } catch (e) {
        console.error(`GET /assignments/:id error ${e}`);
        res.status(500).json({ error: 'failed to get assignment' });
    }
});

// create an assignment
router.post('/', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const { classId, title, description, dueDate, maxPoints } = req.body ?? {};

        if (!classId || !title) {
            return res.status(400).json({ error: 'classId and title are required' });
        }

        const [created] = await db
            .insert(assignments)
            .values({
                classId: Number(classId),
                title,
                description: description ?? null,
                dueDate: dueDate ? new Date(dueDate) : null,
                maxPoints: maxPoints ? Number(maxPoints) : 100,
            })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'class does not exist' });
        }
        console.error(`POST /assignments error ${e}`);
        res.status(500).json({ error: 'failed to create assignment' });
    }
});

// update an assignment
router.put('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid assignment id' });
        }

        const { title, description, dueDate, maxPoints } = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
        if (maxPoints !== undefined) updates.maxPoints = Number(maxPoints);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(assignments)
            .set(updates)
            .where(eq(assignments.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'assignment not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error(`PUT /assignments/:id error ${e}`);
        res.status(500).json({ error: 'failed to update assignment' });
    }
});

// delete an assignment
router.delete('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid assignment id' });
        }

        const [deleted] = await db
            .delete(assignments)
            .where(eq(assignments.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'assignment not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /assignments/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete assignment' });
    }
});

export default router;
