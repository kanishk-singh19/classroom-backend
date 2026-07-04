import { relations } from 'drizzle-orm';
import { pgTable, integer, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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

export const departmentRelations = relations(departments, ({many}) => ({subjects : many(subjects)}))

export const subjectRelations = relations(subjects, ({one,many}) => ({departments : one(departments, {
    fields:[subjects.departmentId],
    references: [departments.id]
    })
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;