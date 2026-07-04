import 'dotenv/config';
import { db } from './index';
import { departments, subjects, users } from './schema';
import { hashPassword } from '../lib/auth';

// A small, deterministic set of seed data so the app has something to show.
const DEPARTMENT_SEED = [
    { code: 'CS', name: 'Computer Science', description: 'Computing, software and systems' },
    { code: 'MATH', name: 'Mathematics', description: 'Pure and applied mathematics' },
    { code: 'PHY', name: 'Physics', description: 'Classical and modern physics' },
    { code: 'CHEM', name: 'Chemistry', description: 'Organic and inorganic chemistry' },
    { code: 'ENG', name: 'English', description: 'Language and literature' },
];

const SUBJECT_SEED = [
    { code: 'CS101', name: 'Introduction to Programming', department: 'Computer Science', description: 'Fundamentals of programming with a modern language.' },
    { code: 'CS201', name: 'Data Structures', department: 'Computer Science', description: 'Core data structures and their trade-offs.' },
    { code: 'MATH101', name: 'Calculus I', department: 'Mathematics', description: 'Limits, derivatives and integrals.' },
    { code: 'PHY101', name: 'Mechanics', department: 'Physics', description: 'Newtonian mechanics and motion.' },
    { code: 'ENG101', name: 'Academic Writing', department: 'English', description: 'Essay structure and academic style.' },
];

// Default accounts (password is the same for all — dev only).
const USER_SEED = [
    { name: 'Alice Admin', email: 'admin@classroom.test', role: 'admin' as const, department: 'Computer Science' },
    { name: 'Tom Teacher', email: 'teacher@classroom.test', role: 'teacher' as const, department: 'Mathematics' },
    { name: 'Sam Student', email: 'student@classroom.test', role: 'student' as const, department: 'Physics' },
];
const SEED_PASSWORD = 'password123';

async function seed() {
    console.log('Seeding departments...');
    const insertedDepartments = await db
        .insert(departments)
        .values(DEPARTMENT_SEED)
        .onConflictDoNothing({ target: departments.code })
        .returning();
    console.log(`  inserted ${insertedDepartments.length} departments`);

    // Build a name -> id lookup from the full table (covers already-seeded rows).
    const allDepartments = await db.select().from(departments);
    const idByName = new Map(allDepartments.map((d) => [d.name, d.id]));

    const subjectRows = SUBJECT_SEED.map((s) => ({
        code: s.code,
        name: s.name,
        description: s.description,
        departmentId: idByName.get(s.department)!,
    })).filter((s) => s.departmentId !== undefined);

    console.log('Seeding subjects...');
    const insertedSubjects = await db
        .insert(subjects)
        .values(subjectRows)
        .onConflictDoNothing({ target: subjects.code })
        .returning();
    console.log(`  inserted ${insertedSubjects.length} subjects`);

    console.log('Seeding users...');
    const hashed = await hashPassword(SEED_PASSWORD);
    const userRows = USER_SEED.map((u) => ({ ...u, password: hashed }));
    const insertedUsers = await db
        .insert(users)
        .values(userRows)
        .onConflictDoNothing({ target: users.email })
        .returning();
    console.log(`  inserted ${insertedUsers.length} users (password: ${SEED_PASSWORD})`);

    console.log('Seed complete.');
}

seed()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    });
