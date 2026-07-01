import { desc,and, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm';
import express from 'express';
import { departments, subjects } from '../db/schema';
import { db } from '../db';

const router = express.Router();

// get all subjects with optional search
router.get('/', async (req :express.Request,res:express.Response) => {
    try {
         const {search, department ,page=1,limit=10} = req.query;
         const currentPage = Math.max(1, +page);
         const limitPerPage = Math.max(1,+limit);
         const offset = (currentPage-1) *limitPerPage;


         const filterConditions = []


        //  if search query exists filter by subject name OR subject code

         if(search){
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            )
         }
         // if department query exists filter by department
         if(department){
            filterConditions.push(ilike(departments.name, `%${department}%`))
         }

        //  combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
         
        const countResult = await db
        .select({count: sql<number> `count(*)`})
        .from(subjects)
        .leftJoin(departments,eq(subjects.departmentId,departments.id))
        .where(whereClause)

        const totalCount = countResult[0]?.count ?? 0;
        const subjectsList = await db.select({ 
            ...getTableColumns(subjects),
            department: { ...getTableColumns(departments) }
        })
        .from(subjects)
        .leftJoin(departments,eq(subjects.departmentId,departments.id))
        .where(whereClause)
        .orderBy(desc(subjects.createdAt))
        .limit(limitPerPage)
        .offset(offset)


        res.status(200).json({
            data:subjectsList,
            pagination:{
                page: currentPage,
                limit:limitPerPage,
                total:totalCount,
                totalPages: Math.ceil(totalCount/limitPerPage)
            }
        })
        
    }catch (e) {
        console.error(`GET /subjects error" ${e}`);
        res.status(500).json({error:'failed to get subjects'})
    }
})

// resolve a department id from either an explicit id or a department name
async function resolveDepartmentId(body: any): Promise<number | null> {
    if (body.departmentId) {
        const id = Number(body.departmentId);
        return Number.isFinite(id) ? id : null;
    }
    if (body.department && typeof body.department === 'string') {
        const [dept] = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.name, body.department))
            .limit(1);
        return dept?.id ?? null;
    }
    return null;
}

// get a single subject with its department
router.get('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid subject id' });
        }

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) },
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(eq(subjects.id, id))
            .limit(1);

        if (!subject) {
            return res.status(404).json({ error: 'subject not found' });
        }

        res.status(200).json({ data: subject });
    } catch (e) {
        console.error(`GET /subjects/:id error ${e}`);
        res.status(500).json({ error: 'failed to get subject' });
    }
});

// create a subject
router.post('/', async (req: express.Request, res: express.Response) => {
    try {
        const { name, code, description } = req.body ?? {};

        if (!name || !code) {
            return res.status(400).json({ error: 'name and code are required' });
        }

        const departmentId = await resolveDepartmentId(req.body ?? {});
        if (!departmentId) {
            return res.status(400).json({ error: 'a valid department is required' });
        }

        const [created] = await db
            .insert(subjects)
            .values({ name, code, description: description ?? null, departmentId })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'a subject with this code already exists' });
        }
        console.error(`POST /subjects error ${e}`);
        res.status(500).json({ error: 'failed to create subject' });
    }
});

// update a subject
router.put('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid subject id' });
        }

        const { name, code, description } = req.body ?? {};
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (code !== undefined) updates.code = code;
        if (description !== undefined) updates.description = description;

        if (req.body?.departmentId || req.body?.department) {
            const departmentId = await resolveDepartmentId(req.body);
            if (!departmentId) {
                return res.status(400).json({ error: 'a valid department is required' });
            }
            updates.departmentId = departmentId;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'no fields to update' });
        }

        const [updated] = await db
            .update(subjects)
            .set(updates)
            .where(eq(subjects.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'subject not found' });
        }

        res.status(200).json({ data: updated });
    } catch (e: any) {
        if (e?.code === '23505') {
            return res.status(409).json({ error: 'a subject with this code already exists' });
        }
        console.error(`PUT /subjects/:id error ${e}`);
        res.status(500).json({ error: 'failed to update subject' });
    }
});

// delete a subject
router.delete('/:id', async (req: express.Request, res: express.Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'invalid subject id' });
        }

        const [deleted] = await db
            .delete(subjects)
            .where(eq(subjects.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'subject not found' });
        }

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /subjects/:id error ${e}`);
        res.status(500).json({ error: 'failed to delete subject' });
    }
});

export default router;