import { and, desc, eq, sql } from 'drizzle-orm';
import express from 'express';
import { classes, enrollments, users } from '../db/schema';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

// Only staff manage enrollments.
const canManage = [requireAuth, requireRole('admin', 'teacher')];
import { isUniqueViolation, isForeignKeyViolation } from '../lib/db-errors';

const router = express.Router();

// Student fields exposed on a roster entry (no password hash).
const studentColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    department: users.department,
};

// list enrollments, filtered by class (used to render a class roster)
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { classId, studentId, page = 1, limit = 100 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const conditions = [];
        if (classId) conditions.push(eq(enrollments.classId, +classId));
        if (studentId) conditions.push(eq(enrollments.studentId, +studentId));
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(whereClause);
        const totalCount = countResult[0]?.count ?? 0;

        const list = await db
            .select({
                id: enrollments.id,
                classId: enrollments.classId,
                createdAt: enrollments.createdAt,
                student: { ...studentColumns },
            })
            .from(enrollments)
            .leftJoin(users, eq(enrollments.studentId, users.id))
            .where(whereClause)
            .orderBy(desc(enrollments.createdAt))
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
        console.error(`GET /enrollments error ${e}`);
        res.status(500).json({ error: 'failed to get enrollments' });
    }
});

// enroll a student into a class (respects the class capacity)
router.post('/', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const { classId, studentId } = req.body ?? {};
        if (!classId || !studentId) {
            return res.status(400).json({ error: 'classId and studentId are required' });
        }

        const [cls] = await db
            .select({ capacity: classes.capacity })
            .from(classes)
            .where(eq(classes.id, Number(classId)))
            .limit(1);
        if (!cls) {
            return res.status(404).json({ error: 'class not found' });
        }

        const countRows = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, Number(classId)));
        const enrolled = Number(countRows[0]?.count ?? 0);
        if (enrolled >= cls.capacity) {
            return res.status(409).json({ error: 'this class is already full' });
        }

        const [created] = await db
            .insert(enrollments)
            .values({ classId: Number(classId), studentId: Number(studentId) })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'student is already enrolled in this class' });
        }
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'class or student does not exist' });
        }
        console.error(`POST /enrollments error ${e}`);
        res.status(500).json({ error: 'failed to enroll student' });
    }
});

// remove an enrollment (unenroll)
router.delete('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid enrollment id' });
        }

        const [deleted] = await db
            .delete(enrollments)
            .where(eq(enrollments.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'enrollment not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /enrollments/:id error ${e}`);
        res.status(500).json({ error: 'failed to remove enrollment' });
    }
});

export default router;
