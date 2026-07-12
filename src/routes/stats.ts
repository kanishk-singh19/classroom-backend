import { desc, eq, sql } from 'drizzle-orm';
import express from 'express';
import { classes, departments, enrollments, subjects, users } from '../db/schema';
import { db } from '../db';

const router = express.Router();

const countOf = async (table: any) => {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(rows[0]?.count ?? 0);
};

// aggregate numbers for the dashboard
router.get('/', async (_req: express.Request, res: express.Response) => {
    try {
        const [subjectCount, departmentCount, classCount, enrollmentCount] =
            await Promise.all([
                countOf(subjects),
                countOf(departments),
                countOf(classes),
                countOf(enrollments),
            ]);

        // users grouped by role
        const roleRows = await db
            .select({ role: users.role, count: sql<number>`count(*)` })
            .from(users)
            .groupBy(users.role);
        const usersByRole = roleRows.map((r) => ({
            role: r.role,
            count: Number(r.count),
        }));
        const teacherCount = usersByRole.find((r) => r.role === 'teacher')?.count ?? 0;
        const studentCount = usersByRole.find((r) => r.role === 'student')?.count ?? 0;

        // classes grouped by status
        const statusRows = await db
            .select({ status: classes.status, count: sql<number>`count(*)` })
            .from(classes)
            .groupBy(classes.status);
        const classesByStatus = statusRows.map((r) => ({
            status: r.status,
            count: Number(r.count),
        }));

        // subjects per department (for a chart)
        const subjectsPerDeptRows = await db
            .select({ department: departments.name, count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .groupBy(departments.name);
        const subjectsByDepartment = subjectsPerDeptRows.map((r) => ({
            department: r.department ?? 'Unknown',
            count: Number(r.count),
        }));

        // a few most-recent classes
        const recentClasses = await db
            .select({
                id: classes.id,
                name: classes.name,
                status: classes.status,
                createdAt: classes.createdAt,
            })
            .from(classes)
            .orderBy(desc(classes.createdAt))
            .limit(5);

        res.status(200).json({
            data: {
                counts: {
                    subjects: subjectCount,
                    departments: departmentCount,
                    classes: classCount,
                    enrollments: enrollmentCount,
                    teachers: teacherCount,
                    students: studentCount,
                },
                usersByRole,
                classesByStatus,
                subjectsByDepartment,
                recentClasses,
            },
        });
    } catch (e) {
        console.error(`GET /stats error ${e}`);
        res.status(500).json({ error: 'failed to load stats' });
    }
});

export default router;
