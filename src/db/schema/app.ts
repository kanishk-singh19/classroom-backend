import { relations } from 'drizzle-orm';
import { pgTable, integer, varchar, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';

const timestamps = {
    createdAt : timestamp('created_at').defaultNow().notNull(),
    updatedAt : timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export const userRole = pgEnum('user_role', ['student', 'teacher', 'admin']);

export const users = pgTable('users', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    role: userRole('role').notNull().default('student'),
    department: varchar('department', { length: 255 }),
    image: varchar('image', { length: 500 }),
    imageCldPubId: varchar('image_cld_pub_id', { length: 255 }),
    ...timestamps
})

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const departments = pgTable ('departments',{
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', {length : 50}).notNull().unique(),
    name: varchar('name', {length : 255}).notNull(),
    description: varchar('description', {length : 255}),
    ...timestamps
})

export const subjects = pgTable ('subjects',{
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, {onDelete: 'restrict' }),
    name: varchar('name', {length : 255}).notNull(),
    code:varchar('code',{length:50}).notNull().unique(),
    description: varchar('description', {length : 255}),
    ...timestamps
})

export const classStatus = pgEnum('class_status', ['active', 'inactive']);

export const classes = pgTable('classes', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
    teacherId: integer('teacher_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    capacity: integer('capacity').notNull().default(30),
    status: classStatus('status').notNull().default('active'),
    bannerUrl: varchar('banner_url', { length: 500 }),
    bannerCldPubId: varchar('banner_cld_pub_id', { length: 255 }),
    inviteCode: varchar('invite_code', { length: 20 }).notNull().unique(),
    ...timestamps
})

export const departmentRelations = relations(departments, ({many}) => ({subjects : many(subjects)}))

export const subjectRelations = relations(subjects, ({one,many}) => ({
    departments : one(departments, {
        fields:[subjects.departmentId],
        references: [departments.id]
    }),
    classes: many(classes)
}));

// A student's membership in a class. A student can only join a class once.
export const enrollments = pgTable('enrollments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps
}, (t) => [
    unique('unique_enrollment').on(t.classId, t.studentId),
]);

export const classRelations = relations(classes, ({ one, many }) => ({
    subject: one(subjects, { fields: [classes.subjectId], references: [subjects.id] }),
    teacher: one(users, { fields: [classes.teacherId], references: [users.id] }),
    enrollments: many(enrollments),
}));

export const enrollmentRelations = relations(enrollments, ({ one }) => ({
    class: one(classes, { fields: [enrollments.classId], references: [classes.id] }),
    student: one(users, { fields: [enrollments.studentId], references: [users.id] }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

// A recurring meeting time for a class (e.g. Monday 09:00-10:00).
export const schedules = pgTable('schedules', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    day: varchar('day', { length: 20 }).notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    ...timestamps
});

export const scheduleRelations = relations(schedules, ({ one }) => ({
    class: one(classes, { fields: [schedules.classId], references: [classes.id] }),
}));

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

// A piece of work set for a class.
export const assignments = pgTable('assignments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    dueDate: timestamp('due_date'),
    maxPoints: integer('max_points').notNull().default(100),
    ...timestamps
});

// A student's submission for an assignment, optionally graded.
export const submissions = pgTable('submissions', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    assignmentId: integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: varchar('content', { length: 2000 }),
    grade: integer('grade'),
    feedback: varchar('feedback', { length: 1000 }),
    ...timestamps
}, (t) => [
    unique('unique_submission').on(t.assignmentId, t.studentId),
]);

export const assignmentRelations = relations(assignments, ({ one, many }) => ({
    class: one(classes, { fields: [assignments.classId], references: [classes.id] }),
    submissions: many(submissions),
}));

export const submissionRelations = relations(submissions, ({ one }) => ({
    assignment: one(assignments, { fields: [submissions.assignmentId], references: [assignments.id] }),
    student: one(users, { fields: [submissions.studentId], references: [users.id] }),
}));

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;