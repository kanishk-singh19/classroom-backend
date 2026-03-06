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

export default router;