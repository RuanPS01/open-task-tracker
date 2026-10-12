// Esquemas de entrada da API. A API valida todo corpo e consulta com eles, e a web
// reaproveita os mesmos esquemas e tipos, então uma regra muda num lugar só.
import { z } from 'zod';
import {
  CURRENCIES,
  DEPENDENCY_TYPES,
  DURATION_FORMATS,
  ESTIMATE_MODES,
  LOCALES,
  MAX_TIME_ENTRY_SECONDS,
  MEMBER_ROLES,
  PRIORITIES,
  TASK_STATUSES,
  THEMES,
  TIME_FORMATS,
} from './constants';
import { isIsoDate } from './dates';

// Ids em corpo JSON chegam como número; parâmetros de URL usam idParamSchema (com coerção).
export const idSchema = z.number().int().positive();
export const idParamSchema = z.coerce.number().int().positive();
export const isoDateSchema = z.string().refine(isIsoDate, { message: 'Data inválida (AAAA-MM-DD)' });
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
const nameSchema = z.string().trim().min(1).max(200);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida');
const moneySchema = z.number().min(0).max(1_000_000);
const secondsSchema = z.number().int().min(0).max(MAX_TIME_ENTRY_SECONDS * 100);

// --- Autenticação e perfil -------------------------------------------------

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
  workspaceName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().max(64).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const preferencesSchema = z.object({
  theme: z.enum(THEMES),
  locale: z.enum(LOCALES),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  timeFormat: z.enum(TIME_FORMATS),
  durationFormat: z.enum(DURATION_FORMATS),
  timezone: z.string().min(1).max(64),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.email().max(200).transform((value) => value.toLowerCase()).optional(),
  preferences: preferencesSchema.partial().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const switchWorkspaceSchema = z.object({ workspaceId: idSchema });

// --- Workspace e membros ---------------------------------------------------

export const createWorkspaceSchema = z.object({ name: z.string().trim().min(1).max(120) });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  currency: z.enum(CURRENCIES).optional(),
  defaultHourlyRate: moneySchema.nullable().optional(),
  workingDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Dias repetidos')
    .optional(),
  autoSchedule: z.boolean().optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const addMemberSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200).transform((value) => value.toLowerCase()),
  role: z.enum(MEMBER_ROLES).default('member'),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
  hourlyRate: moneySchema.nullable().optional(),
});
export type AddMemberInput = z.input<typeof addMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(MEMBER_ROLES).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
  hourlyRate: moneySchema.nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// --- Clientes e tags -------------------------------------------------------

export const createClientSchema = z.object({ name: nameSchema });
export const updateClientSchema = z.object({
  name: nameSchema.optional(),
  archived: z.boolean().optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createTagSchema = z.object({ name: z.string().trim().min(1).max(60) });
export const updateTagSchema = createTagSchema;
export type CreateTagInput = z.infer<typeof createTagSchema>;

// --- Projetos --------------------------------------------------------------

export const createProjectSchema = z.object({
  name: nameSchema,
  color: colorSchema,
  clientId: idSchema.nullable().optional(),
  billable: z.boolean().optional(),
  estimateSeconds: secondsSchema.nullable().optional(),
  hourlyRate: moneySchema.nullable().optional(),
  startDate: isoDateSchema.nullable().optional(),
  endDate: isoDateSchema.nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().extend({
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// --- Tarefas e dependências -----------------------------------------------

const taskFields = {
  name: nameSchema,
  projectId: idSchema.nullable().optional(),
  parentId: idSchema.nullable().optional(),
  description: z.string().max(10_000).optional(),
  notes: z.string().max(50_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.literal(PRIORITIES).optional(),
  startDate: isoDateSchema.nullable().optional(),
  dueDate: isoDateSchema.nullable().optional(),
  estimateSeconds: secondsSchema.nullable().optional(),
  estimateMode: z.enum(ESTIMATE_MODES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  isMilestone: z.boolean().optional(),
  billable: z.boolean().optional(),
  position: z.number().optional(),
  assigneeIds: z.array(idSchema).max(50).optional(),
  tagIds: z.array(idSchema).max(50).optional(),
};

export const createTaskSchema = z.object(taskFields);
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z.object(taskFields).partial();
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const scheduleTasksSchema = z.object({
  updates: z
    .array(
      z.object({
        id: idSchema,
        startDate: isoDateSchema.nullable(),
        dueDate: isoDateSchema.nullable(),
      }),
    )
    .min(1)
    .max(500),
});
export type ScheduleTasksInput = z.infer<typeof scheduleTasksSchema>;

export const createDependencySchema = z.object({
  predecessorId: idSchema,
  successorId: idSchema,
  type: z.enum(DEPENDENCY_TYPES).default('FS'),
  lagDays: z.number().int().min(-365).max(365).default(0),
});
export type CreateDependencyInput = z.input<typeof createDependencySchema>;

export const updateDependencySchema = z.object({
  type: z.enum(DEPENDENCY_TYPES).optional(),
  lagDays: z.number().int().min(-365).max(365).optional(),
});
export type UpdateDependencyInput = z.infer<typeof updateDependencySchema>;

// --- Apontamentos de tempo -------------------------------------------------

const timeEntryFields = {
  description: z.string().max(3000).optional(),
  projectId: idSchema.nullable().optional(),
  taskId: idSchema.nullable().optional(),
  billable: z.boolean().optional(),
  tagIds: z.array(idSchema).max(50).optional(),
};

export const startTimerSchema = z.object(timeEntryFields);
export type StartTimerInput = z.infer<typeof startTimerSchema>;

export const createTimeEntrySchema = z.object({
  ...timeEntryFields,
  start: isoDateTimeSchema,
  stop: isoDateTimeSchema,
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

export const updateTimeEntrySchema = z.object({
  ...timeEntryFields,
  start: isoDateTimeSchema.optional(),
  stop: isoDateTimeSchema.nullable().optional(),
});
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;

export const timeEntriesQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  userId: idSchema.optional(),
});

// --- Relatórios ------------------------------------------------------------

const idListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const parts = (Array.isArray(value) ? value : value.split(',')).filter(Boolean);
    return parts.map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  });

export const reportQuerySchema = z.object({
  start: isoDateSchema,
  end: isoDateSchema,
  tz: z.string().max(64).default('UTC'),
  userIds: idListSchema,
  projectIds: idListSchema,
  clientIds: idListSchema,
  tagIds: idListSchema,
  taskIds: idListSchema,
  billable: z.enum(['true', 'false']).optional(),
  description: z.string().max(200).optional(),
});
export type ReportQueryInput = z.input<typeof reportQuerySchema>;
export type ReportQuery = z.output<typeof reportQuerySchema>;
