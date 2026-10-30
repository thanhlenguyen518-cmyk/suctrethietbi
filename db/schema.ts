import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),version:integer('version').notNull().default(0),data:text('data').notNull()});
export const mailOutbox=sqliteTable('mail_outbox',{id:text('id').primaryKey(),owner:text('owner').notNull(),requestId:text('request_id').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('pending'),created:integer('created').notNull(),providerId:text('provider_id'),error:text('error')});
export const jobLocks=sqliteTable('job_locks',{id:text('id').primaryKey(),token:text('token').notNull(),until:integer('until').notNull()});
