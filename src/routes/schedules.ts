import { asc, eq } from 'drizzle-orm';
import express from 'express';
import { schedules } from '../db/schema';
import { db } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { isForeignKeyViolation } from '../lib/db-errors';

const router = express.Router();

// Only staff manage schedules.
const canManage = [requireAuth, requireRole('admin', 'teacher')];

const DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
];

// list schedules, filtered by class
router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const { classId } = req.query;

        const list = await db
            .select()
            .from(schedules)
            .where(classId ? eq(schedules.classId, +classId) : undefined)
            .orderBy(asc(schedules.startTime));

        res.status(200).json({ data: list, pagination: { total: list.length } });
    } catch (e) {
        console.error(`GET /schedules error ${e}`);
        res.status(500).json({ error: 'failed to get schedules' });
    }
});

// add a schedule slot to a class
router.post('/', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const { classId, day, startTime, endTime } = req.body ?? {};

        if (!classId || !day || !startTime || !endTime) {
            return res
                .status(400)
                .json({ error: 'classId, day, startTime and endTime are required' });
        }
        if (!DAYS.includes(String(day).toLowerCase())) {
            return res.status(400).json({ error: 'invalid day' });
        }

        const [created] = await db
            .insert(schedules)
            .values({
                classId: Number(classId),
                day: String(day).toLowerCase(),
                startTime,
                endTime,
            })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (isForeignKeyViolation(e)) {
            return res.status(400).json({ error: 'class does not exist' });
        }
        console.error(`POST /schedules error ${e}`);
        res.status(500).json({ error: 'failed to add schedule' });
    }
});

// remove a schedule slot
router.delete('/:id', ...canManage, async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid schedule id' });
        }

        const [deleted] = await db
            .delete(schedules)
            .where(eq(schedules.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'schedule not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /schedules/:id error ${e}`);
        res.status(500).json({ error: 'failed to remove schedule' });
    }
});

export default router;
