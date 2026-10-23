import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);

export const starMapReadFields = {
  id: z.string().uuid(),
  canonicalForm: text(500),
  meaningZh: text(500),
  updatedAt: z.string().datetime({ offset: true }),
  form: text(500),
  languageFunction: text(300),
  usageBoundary: text(500),
  example: text(1_000),
};

export const starMapListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
}).strict();
