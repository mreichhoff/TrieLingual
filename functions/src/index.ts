import { setGlobalOptions } from "firebase-functions";
import { onCallGenkit, HttpsError } from "firebase-functions/v2/https";
import { genkit } from "genkit";
import { vertexAI, gemini20Flash001 } from '@genkit-ai/vertexai';
import * as admin from 'firebase-admin';
import { isUserAuthorized } from "./auth";
import * as logger from "firebase-functions/logger";
import {
    explanationSchema,
    explanationInputSchema,
    englishExplanationSchema,
    explainEnglishInputSchema,
    imageAnalysisSchema,
    analyzeImageInputSchema,
    sentenceGenerationSchema,
    generateSentencesInputSchema,
    analyzeCollocationSchema,
    analyzeCollocationInputSchema
} from "./schema";

setGlobalOptions({ maxInstances: 10 });

let firebaseApp: admin.app.App;

// according to the docs, there's no need for an API key when using the vertex API,
// as instead the service principal is granted a vertex API role.
// that said, "you have no secrets bound" shows as a debug log.
// the docs aren't super clear, but see
// https://firebase.google.com/docs/functions/oncallgenkit?hl=en&authuser=0#api-creds
// and choose the Gemini (Vertex AI) tab.
const ai = genkit({
    plugins: [
        vertexAI({ location: 'us-central1' }),
    ],
    model: gemini20Flash001,
});

const ExplanationSchema = ai.defineSchema('ExplanationSchema', explanationSchema);
const ExplanationInputSchema = ai.defineSchema('ExplanationInputSchema', explanationInputSchema);
const explainTargetPrompt = ai.prompt<typeof ExplanationInputSchema, typeof ExplanationSchema>('explain-target');
const EnglishExplanationSchema = ai.defineSchema('EnglishExplanationSchema', englishExplanationSchema);
const ExplainEnglishInputSchema = ai.defineSchema('ExplainEnglishInputSchema', explainEnglishInputSchema);
const explainEnglishPrompt = ai.prompt<typeof ExplainEnglishInputSchema, typeof EnglishExplanationSchema>('explain-english');

// TODO: dig into streamSchema and streaming structured responses
const explainFlow = ai.defineFlow({
    name: "explainText",
    inputSchema: explanationInputSchema,
    outputSchema: explanationSchema,
}, async (request, { context }) => {
    if (!firebaseApp) {
        firebaseApp = admin.initializeApp();
    }
    // TODO: there's some authorization syntactic sugar with onCallGenkit, but it appears deprecated
    const isAuthorized = await isUserAuthorized(context);
    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "user not authorized");
    }
    const { output } = await explainTargetPrompt(request);
    if (!output) {
        throw new HttpsError("internal", 'oh no, the model like, failed?');
    }
    return output;
},
);

const explainEnglishFlow = ai.defineFlow({
    name: "explainEnglish",
    inputSchema: explainEnglishInputSchema,
    outputSchema: englishExplanationSchema,
}, async (request, { context }) => {
    if (!firebaseApp) {
        firebaseApp = admin.initializeApp();
    }
    const isAuthorized = await isUserAuthorized(context);
    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "user not authorized");
    }
    const { output } = await explainEnglishPrompt(request);
    if (!output) {
        throw new HttpsError("internal", 'oh no, the model like, failed?');
    }
    return output;
});

export const explainText = onCallGenkit(explainFlow);

export const explainEnglishText = onCallGenkit(explainEnglishFlow);

// TODO: set up flows in separate files (text analysis in one, image in another)
const ImageAnalysisSchema = ai.defineSchema('ImageAnalysisSchema', imageAnalysisSchema);
const ImageAnalysisInputSchema = ai.defineSchema('ImageAnalysisInputSchema', analyzeImageInputSchema);
const analyzeImagePrompt = ai.prompt<typeof ImageAnalysisInputSchema, typeof ImageAnalysisSchema>('analyze-image');
const analyzeImageFlow = ai.defineFlow({
    name: "analyzeImage",
    inputSchema: analyzeImageInputSchema,
    outputSchema: imageAnalysisSchema,
}, async (request, { context }) => {
    if (!firebaseApp) {
        firebaseApp = admin.initializeApp();
    }
    const isAuthorized = await isUserAuthorized(context);
    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "user not authorized");
    }
    const { output } = await analyzeImagePrompt(request);
    if (!output) {
        throw new HttpsError("internal", 'oh no, the model like, failed?');
    }
    return output;
});

export const analyzeImage = onCallGenkit({
    memory: '1GiB',
}, analyzeImageFlow);

const SentenceGenerationSchema = ai.defineSchema(
    'SentenceGenerationSchema',
    sentenceGenerationSchema
);
const GenerateSentencesInputSchema = ai.defineSchema(
    'GenerateSentencesInputSchema',
    generateSentencesInputSchema
);
const generateSentencesPrompt = ai.prompt<
    typeof GenerateSentencesInputSchema, typeof SentenceGenerationSchema>('generate-sentences');
const generateSentencesFlow = ai.defineFlow({
    name: "generateSentences",
    inputSchema: generateSentencesInputSchema,
    outputSchema: sentenceGenerationSchema,
}, async (request, { context }) => {
    if (!firebaseApp) {
        firebaseApp = admin.initializeApp();
    }
    const isAuthorized = await isUserAuthorized(context);
    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "user not authorized");
    }
    const { output } = await generateSentencesPrompt(request);
    if (!output) {
        throw new HttpsError("internal", 'oh no, the model like, failed?');
    }
    return output;
});

export const generateSentences = onCallGenkit(generateSentencesFlow);

const AnalyzeCollocationSchema = ai.defineSchema('AnalyzeCollocationSchema', analyzeCollocationSchema);
const AnalyzeCollocationInputSchema = ai.defineSchema('AnalyzeCollocationInputSchema', analyzeCollocationInputSchema);

const analyzeCollocationPrompt = ai.prompt<typeof AnalyzeCollocationInputSchema, typeof AnalyzeCollocationSchema>('analyze-collocation');

const analyzeCollocationFlow = ai.defineFlow({
    name: "analyzeCollocation",
    inputSchema: analyzeCollocationInputSchema,
    outputSchema: analyzeCollocationSchema,
}, async (request, { context }) => {
    if (!firebaseApp) {
        firebaseApp = admin.initializeApp();
    }
    const isAuthorized = await isUserAuthorized(context);
    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "user not authorized");
    }
    const { output } = await analyzeCollocationPrompt(request);
    if (!output) {
        throw new HttpsError("internal", 'oh no, the model like, failed?');
    }
    return output;
},
);

export const analyzeCollocation = onCallGenkit(analyzeCollocationFlow);
