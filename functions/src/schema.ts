import { z } from "genkit";

const sentenceSchema = z.array(
    z.object({
        targetLanguageText: z.string(),
        englishTranslation: z.string(),
    }));

// TODO: should the `explanationSchema` and `englishExplanationSchema` also split input into sentences?
// kinda seems like the user would've split it up themselves if that was the intention, vs an image
// where it's often tougher to do that.
export const explanationSchema = z.object({
    plainTextExplanation: z.string(),
    englishTranslation: z.string(),
    grammarHighlights: z.array(
        z.object({
            grammarConceptName: z.string(),
            grammarConceptExplanation: z.string(),
        })),
});

export const englishExplanationSchema = z.object({
    plainTextExplanation: z.string(),
    targetLanguageTranslation: z.string(),
    grammarHighlights: z.array(
        z.object({
            grammarConceptName: z.string(),
            grammarConceptExplanation: z.string(),
        })),
});

// TODO: these are all quite similar schemas, and should
// likely be combined. The frontend benefits from a uniform
// interface.
export const imageAnalysisSchema = z.object({
    sentences: sentenceSchema,
    plainTextExplanation: z.string(),
    grammarHighlights: z.array(
        z.object({
            grammarConceptName: z.string(),
            grammarConceptExplanation: z.string(),
        })),
});

export const generateSentencesInputSchema = z.object({
    word: z.string(),
    targetLanguage: z.string(),
    definitions: z.array(z.string()),
});

export const analyzeImageInputSchema = z.object({
    base64ImageUrl: z.string(),
    targetLanguage: z.string(),
});

export const explanationInputSchema = z.object({
    text: z.string(),
    targetLanguage: z.string(),
});

export const explainEnglishInputSchema = z.object({
    text: z.string(),
    targetLanguage: z.string(),
});

export const analyzeCollocationInputSchema = z.object({
    collocation: z.string(),
    targetLanguage: z.string(),
});

export const sentenceGenerationSchema = z.object({
    sentences: sentenceSchema,
});

export const analyzeCollocationSchema = z.object({
    englishTranslation: z.string(),
    plainTextExplanation: z.string(),
    sentences: sentenceSchema,
});
