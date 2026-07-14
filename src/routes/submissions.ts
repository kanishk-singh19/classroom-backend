import { and, desc, eq } from 'drizzle-orm';
import express from 'express';
import { submissions, users } from '../db/schema';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { isUniqueViolation, isForeignKeyViolation } from '../lib/db-errors';

const router = express.Router();

// Only staff grade submissions.
const canGrade = [requireAuth, requireRole('admin', 'teacher')];

const studentColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
};

// list submissions, filtered by assignment or student
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { assignmentId, studentId } = req.query;

        const conditions = [];
        if (assignmentId) conditions.push(eq(submissions.assignmentId, +assignmentId));
        if (studentId) conditions.push(eq(submissions.studentId, +studentId));
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const list = await db
            .select({
                id: submissions.id,
                assignmentId: submissions.assignmentId,
                content: submissions.content,
                grade: submissions.grade,
                feedback: submissions.feedback,
                createdAt: submissions.createdAt,
                student: { ...studentColumns },
            })
            .from(submissions)
            .leftJoin(users, eq(submissions.studentId, users.id))
            .where(whereClause)
            .orderBy(desc(submissions.createdAt));

        res.status(200).json({ data: list, pagination: { total: list.length } });
    } catch (e) {
        console.error(`GET /submissions error ${e}`);
        res.status(500).json({ error: 'failed to get submissions' });
    }
});

// submit work for an assignment (any signed-in user, typically a student)
router.post('/', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const { assignmentId, studentId, content } = req.body ?? {};
        // Default to the authenticated user when no studentId is given.
        const student = studentId ? Number(studentId) : req.auth!.sub;

        if (!assignmentId || !content) {
            return res.status(400).json({ error: 'assignmentId and content are required' });
        }

        const [created] = await db
            .insert(submissions)
            .values({ assignmentId: Number(assignmentId), studentId: student, content })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isUniqueViolation(e)) {
            return res.status(409).json({ error: 'you have already submitted for this assignment' });
        }
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'assignment or student does not exist' });
        }
        console.error(`POST /submissions error ${e}`);
        res.status(500).json({ error: 'failed to submit' });
    }
});

// grade a submission (staff only)
router.put('/:id', ...canGrade, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid submission id' });
        }

        const { grade, feedback } = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (grade !== undefined) updates.grade = grade === null ? null : Number(grade);
        if (feedback !== undefined) updates.feedback = feedback;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(submissions)
            .set(updates)
            .where(eq(submissions.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'submission not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error(`PUT /submissions/:id error ${e}`);
        res.status(500).json({ error: 'failed to grade submission' });
    }
});

// delete a submission
router.delete('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid submission id' });
        }

        const [deleted] = await db
            .delete(submissions)
            .where(eq(submissions.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'submission not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /submissions/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete submission' });
    }
});

export default router;
