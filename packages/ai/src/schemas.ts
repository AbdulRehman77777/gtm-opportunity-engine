import { z } from 'zod';

const groundedItem = z.object({
  text: z.string().min(1).max(600), classification: z.enum(['FACT', 'OBSERVATION', 'HYPOTHESIS']), confidence: z.number().min(0).max(1), evidenceIds: z.array(z.string()).default([])
});
export const companyAnalysisSchema = z.object({
  companySummary: z.string().max(1200), industry: z.string().max(160).nullable(), businessModel: z.string().max(300).nullable(), companyStage: z.string().max(120).nullable(),
  products: z.array(z.string().max(200)).max(20), customerTypes: z.array(z.string().max(160)).max(20), technicalFocus: z.array(z.string().max(160)).max(20),
  aiRelevance: z.number().min(0).max(1), engineeringNeed: z.number().min(0).max(1), buyingIntent: z.number().min(0).max(1),
  possiblePainPoints: z.array(groundedItem).max(10), recommendedServices: z.array(groundedItem).max(10), signals: z.array(groundedItem.extend({ type: z.string().max(100) })).max(15),
  risks: z.array(groundedItem).max(10), confidence: z.number().min(0).max(1)
});
export type CompanyAnalysis = z.infer<typeof companyAnalysisSchema>;
