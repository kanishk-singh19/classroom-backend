import { desc, and, eq, getTableColumns, ilike, sql } from 'drizzle-orm';
import express from 'express';
import { classes, subjects, users } from '../db/schema';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

// Only staff can create/modify classes.
const canManage = [requireAuth, requireRole('admin', 'teacher')];
import { isUniqueViolation, isForeignKeyViolation } from '../lib/db-errors';
import { generateInviteCode } from '../lib/invite-code';

const router = express.Router();

// Teacher columns are exposed without the password hash.
const teacherColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    department: users.department,
};

// Shared select shape: a class row joined with its subject and teacher.
const classSelection = {
    ...getTableColumns(classes),
    subject: { ...getTableColumns(subjects) },
    teacher: { ...teacherColumns },
};

const baseQuery = () =>
    db
        .select(classSelection)
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(users, eq(classes.teacherId, users.id));

// list classes, filterable by search / status / subject / teacher
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { search, status, subject, teacher, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const conditions = [];
        if (search) conditions.push(ilike(classes.name, `%${search}%`));
        if (status === 'active' || status === 'inactive') {
            conditions.push(eq(classes.status, status));
        }
        if (subject) conditions.push(eq(classes.subjectId, +subject));
        if (teacher) conditions.push(eq(classes.teacherId, +teacher));
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(whereClause);
        const totalCount = countResult[0]?.count ?? 0;

        const list = await baseQuery()
            .where(whereClause)
            .orderBy(desc(classes.createdAt))
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
        console.error(`GET /classes error ${e}`);
        res.status(500).json({ error: 'failed to get classes' });
    }
});

// get a single class with its subject and teacher
router.get('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid class id' });
        }

        const [item] = await baseQuery().where(eq(classes.id, id)).limit(1);
        if (!item) {
            return res.status(404).json({ error: 'class not found' });
        }

        res.status(200).json({ data: item });
    } catch (e) {
        console.error(`GET /classes/:id error ${e}`);
        res.status(500).json({ error: 'failed to get class' });
    }
});

// create a class (generates a unique invite code)
router.post('/', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const {
            name,
            description,
            subjectId,
            teacherId,
            capacity,
            status,
            bannerUrl,
            bannerCldPubId,
        } = req.body ?? {};

        if (!name || !subjectId || !teacherId) {
            return res
                .status(400)
                .json({ error: 'name, subjectId and teacherId are required' });
        }

        const [created] = await db
            .insert(classes)
            .values({
                name,
                description: description ?? null,
                subjectId: Number(subjectId),
                teacherId: Number(teacherId),
                capacity: capacity ? Number(capacity) : 30,
                status: status === 'inactive' ? 'inactive' : 'active',
                bannerUrl: bannerUrl ?? null,
                bannerCldPubId: bannerCldPubId ?? null,
                inviteCode: generateInviteCode(),
            })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            // Extremely rare invite-code clash — ask the client to retry.
            return res.status(409).json({ error: 'could not generate a unique code, please retry' });
        }
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'subject or teacher does not exist' });
        }
        console.error(`POST /classes error ${e}`);
        res.status(500).json({ error: 'failed to create class' });
    }
});

// update a class
router.put('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid class id' });
        }

        const body = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.subjectId !== undefined) updates.subjectId = Number(body.subjectId);
        if (body.teacherId !== undefined) updates.teacherId = Number(body.teacherId);
        if (body.capacity !== undefined) updates.capacity = Number(body.capacity);
        if (body.status === 'active' || body.status === 'inactive') updates.status = body.status;
        if (body.bannerUrl !== undefined) updates.bannerUrl = body.bannerUrl;
        if (body.bannerCldPubId !== undefined) updates.bannerCldPubId = body.bannerCldPubId;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(classes)
            .set(updates)
            .where(eq(classes.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'class not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'subject or teacher does not exist' });
        }
        console.error(`PUT /classes/:id error ${e}`);
        res.status(500).json({ error: 'failed to update class' });
    }
});

// delete a class
router.delete('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid class id' });
        }

        const [deleted] = await db
            .delete(classes)
            .where(eq(classes.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'class not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /classes/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete class' });
    }
});

export default router;
