import { z } from 'zod'

// Zod schema for creating a new option position
export const createOptionPositionSchema = z.object({
  // Required fields
  openDate: z.string().min(1, 'Open date is required').or(z.date()),
  stockTicker: z
    .string()
    .min(1, 'Stock ticker is required')
    .max(10, 'Ticker must be 10 characters or less')
    .transform((val) => val.toUpperCase()),
  expiration: z.string().min(1, 'Expiration date is required').or(z.date()),
  type: z.enum(['put', 'call'], {
    required_error: 'Option type is required',
  }),
  contracts: z
    .number({ required_error: 'Number of contracts is required' })
    .int('Must be a whole number')
    .positive('Must be greater than 0'),
  strike: z
    .number({ required_error: 'Strike price is required' })
    .positive('Must be greater than 0'),
  premium: z
    .number({ required_error: 'Premium is required' })
    .nonnegative('Must be 0 or greater'),

  // Stock ownership
  ownsStock: z.boolean().default(false),
  stockCostBasis: z.number().positive('Must be greater than 0').optional(),

  // Optional fields
  assigned: z.boolean().default(false),
  openFees: z.number().nonnegative('Fees must be 0 or greater').optional(),
  closeDate: z.string().optional().or(z.date().optional()),
  premiumPaidToClose: z
    .number()
    .nonnegative('Premium must be 0 or greater')
    .optional(),
  closeFees: z.number().nonnegative('Fees must be 0 or greater').optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

// For form inputs (allows string numbers that will be coerced)
export const createOptionPositionFormSchema = z.object({
  // Required fields
  openDate: z.string().min(1, 'Open date is required'),
  stockTicker: z
    .string()
    .min(1, 'Stock ticker is required')
    .max(10, 'Ticker must be 10 characters or less')
    .transform((val) => val.toUpperCase()),
  expiration: z.string().min(1, 'Expiration date is required'),
  type: z.enum(['put', 'call'], {
    required_error: 'Option type is required',
  }),
  contracts: z.string().transform((val, ctx) => {
    const trimmed = val?.trim()
    if (!trimmed || trimmed === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Number of contracts is required',
      })
      return z.NEVER
    }
    const num = parseInt(trimmed, 10)
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid number',
      })
      return z.NEVER
    }
    if (num <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be greater than 0',
      })
      return z.NEVER
    }
    return num
  }),
  strike: z.string().transform((val, ctx) => {
    const trimmed = val?.trim()
    if (!trimmed || trimmed === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Strike price is required',
      })
      return z.NEVER
    }
    const num = parseFloat(trimmed)
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid number',
      })
      return z.NEVER
    }
    if (num <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be greater than 0',
      })
      return z.NEVER
    }
    return num
  }),
  premium: z.string().transform((val, ctx) => {
    const trimmed = val?.trim()
    if (!trimmed || trimmed === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Premium is required',
      })
      return z.NEVER
    }
    const num = parseFloat(trimmed)
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid number',
      })
      return z.NEVER
    }
    if (num < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be 0 or greater',
      })
      return z.NEVER
    }
    return num
  }),

  // Stock ownership
  ownsStock: z.string().transform((val) => val === 'yes'),
  stockCostBasis: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Must be a valid number')
      if (num <= 0) throw new Error('Must be greater than 0')
      return num
    }),

  // Optional fields
  assigned: z.string().transform((val) => val === 'yes'),
  openFees: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Must be a valid number')
      if (num < 0) throw new Error('Must be 0 or greater')
      return num
    }),
  closeDate: z.string().optional(),
  premiumPaidToClose: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Must be a valid number')
      if (num < 0) throw new Error('Must be 0 or greater')
      return num
    }),
  closeFees: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const num = parseFloat(val)
      if (isNaN(num)) throw new Error('Must be a valid number')
      if (num < 0) throw new Error('Must be 0 or greater')
      return num
    }),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

export type CreateOptionPositionFormData = z.infer<typeof createOptionPositionFormSchema>
export type CreateOptionPositionData = z.infer<typeof createOptionPositionSchema>
