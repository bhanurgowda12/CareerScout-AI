import { useRef, useState } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { appCheck, firebaseApp } from './firebase.js';

const recommendationSchema = {
  type: 'object',
  properties: {
    careerRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          careerPath: { type: 'string' },
          compatibilityScore: { type: 'integer', minimum: 0, maximum: 100 },
          whyItSuits: { type: 'string' },
          relevantSkills: { type: 'array', items: { type: 'string' } },
          missingSkills: { type: 'array', items: { type: 'string' } },
          skillLearningPlan: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                skill: { type: 'string' },
                priority: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
                sequenceOrder: { type: 'integer', minimum: 1 },
              },
              required: ['skill', 'priority', 'sequenceOrder'],
              additionalProperties: false,
            },
          },
          learningRoadmap: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phase: { type: 'string' },
                timeframe: { type: 'string' },
                actions: { type: 'array', items: { type: 'string' } },
              },
              required: ['phase', 'timeframe', 'actions'],
              additionalProperties: false,
            },
          },
          suggestedPortfolioProject: { type: 'string' },
          nextSteps: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'careerPath',
          'compatibilityScore',
          'whyItSuits',
          'relevantSkills',
          'missingSkills',
          'skillLearningPlan',
          'learningRoadmap',
          'suggestedPortfolioProject',
          'nextSteps',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['careerRecommendations'],
  additionalProperties: false,
};

const generativeModel = firebaseApp
  ? getGenerativeModel(
    getAI(firebaseApp, { backend: new GoogleAIBackend() }),
    {
      model: 'gemini-3.8-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: recommendationSchema,
      },
    },
  )
  : null;

export class CareerRecommendationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'CareerRecommendationError';
  }
}

function safeDiagnosticCode(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_./-]{1,80}$/.test(value)
    ? value
    : undefined;
}

function reportRecommendationFailure(error, categoryOverride) {
  const source = error?.cause || error;
  const customErrorData = source?.customErrorData || source?.customData || {};
  const errorDetails = Array.isArray(customErrorData.errorDetails) ? customErrorData.errorDetails : [];
  const serviceErrorCode = errorDetails
    .map((detail) => detail?.reason || detail?.code)
    .find((code) => typeof code === 'string');
  const responseErrorCode = customErrorData.response?.error?.code;
  const status = Number(customErrorData.status || source?.status);
  const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  const searchableText = [error?.message, source?.message, ...errorDetails.map((detail) => detail?.reason)]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const firebaseErrorCode = safeDiagnosticCode(source?.code || error?.code);
  const category = categoryOverride
    || (/app.?check|attest/.test(searchableText)
      ? 'app-check'
      : httpStatus === 401 || serviceErrorCode === 'UNAUTHENTICATED'
        ? 'authentication'
        : httpStatus === 403
          ? 'permission-denied'
          : httpStatus === 429 || /quota|resource.exhausted|billing/.test(searchableText)
            ? 'quota-or-billing'
            : firebaseErrorCode === 'api-not-enabled'
              ? 'firebase-ai-logic-disabled'
              : /timeout|taking too long/.test(searchableText)
                ? 'timeout'
                : /malformed json|invalid recommendations|unexpected format|parse-failed/.test(searchableText)
                  ? 'invalid-ai-response'
                  : httpStatus >= 500
                    ? 'service-error'
                    : 'request-error');

  console.error('[CareerScout AI] Recommendation request failed', {
    category,
    httpStatus,
    firebaseErrorCode,
    serviceErrorCode: safeDiagnosticCode(serviceErrorCode),
    geminiErrorCode: safeDiagnosticCode(responseErrorCode),
  });
}

function normalizeStudentProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new CareerRecommendationError('Provide a student profile to request recommendations.');
  }

  const education = profile.education && typeof profile.education === 'object'
    ? profile.education
    : {};

  return {
    degree: profile.degree ?? education.degree ?? '',
    branch: profile.branch ?? education.branch ?? education.specialization ?? '',
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    experienceLevel: profile.experienceLevel ?? '',
    education: {
      college: profile.college ?? education.college ?? education.collegeName ?? '',
      graduationYear: profile.graduationYear ?? education.graduationYear ?? '',
    },
    projects: Array.isArray(profile.projects)
      ? profile.projects.map((project) => ({
        name: project?.name ?? '',
        description: project?.description ?? '',
        technologies: project?.technologies ?? project?.technologiesUsed ?? '',
      }))
      : [],
    certifications: Array.isArray(profile.certifications)
      ? profile.certifications.map((certification) => ({
        name: certification?.name ?? '',
        issuer: certification?.issuer ?? '',
      }))
      : [],
  };
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(
    (item) => typeof item === 'string' && item.trim().length > 0,
  );
}

function validateRecommendations(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.careerRecommendations)) {
    throw new CareerRecommendationError('Gemini returned recommendations in an unexpected format. Please try again.');
  }

  const validRecommendations = value.careerRecommendations.every((recommendation) => (
    recommendation
    && typeof recommendation.careerPath === 'string'
    && recommendation.careerPath.trim().length > 0
    && Number.isInteger(recommendation.compatibilityScore)
    && recommendation.compatibilityScore >= 0
    && recommendation.compatibilityScore <= 100
    && typeof recommendation.whyItSuits === 'string'
    && recommendation.whyItSuits.trim().length > 0
    && isStringArray(recommendation.relevantSkills)
    && isStringArray(recommendation.missingSkills)
    && Array.isArray(recommendation.skillLearningPlan)
    && recommendation.skillLearningPlan.length === recommendation.missingSkills.length
    && recommendation.skillLearningPlan.every((item) => (
      item
      && typeof item.skill === 'string'
      && item.skill.trim().length > 0
      && recommendation.missingSkills.some((skill) => skill.toLowerCase() === item.skill.toLowerCase())
      && ['Beginner', 'Intermediate', 'Advanced'].includes(item.priority)
      && Number.isInteger(item.sequenceOrder)
      && item.sequenceOrder > 0
    ))
    && new Set(recommendation.skillLearningPlan.map((item) => item.skill.toLowerCase())).size
      === recommendation.skillLearningPlan.length
    && Array.isArray(recommendation.learningRoadmap)
    && recommendation.learningRoadmap.length > 0
    && recommendation.learningRoadmap.every((phase) => (
      phase
      && typeof phase.phase === 'string'
      && typeof phase.timeframe === 'string'
      && isStringArray(phase.actions)
      && phase.actions.length > 0
    ))
    && typeof recommendation.suggestedPortfolioProject === 'string'
    && recommendation.suggestedPortfolioProject.trim().length > 0
    && isStringArray(recommendation.nextSteps)
    && recommendation.nextSteps.length > 0
  ));

  const careerTitles = value.careerRecommendations.map((recommendation) => (
    typeof recommendation?.careerPath === 'string' ? recommendation.careerPath.trim().toLowerCase() : ''
  ));
  if (
    value.careerRecommendations.length < 3
    || value.careerRecommendations.length > 5
    || new Set(careerTitles).size !== careerTitles.length
    || !validRecommendations
  ) {
    throw new CareerRecommendationError('Gemini returned incomplete or invalid recommendations. Please try again.');
  }

  return value;
}

let activeGeneration = null;

export async function generateCareerRecommendations(studentProfile) {
  if (!generativeModel) {
    const error = new CareerRecommendationError(
      'Firebase is not configured. Add the Firebase Vite environment values and restart the frontend.',
    );
    reportRecommendationFailure(error, 'missing-firebase-configuration');
    throw error;
  }

  if (!appCheck) {
    const error = new CareerRecommendationError(
      'Firebase App Check is not configured. Set VITE_FIREBASE_APP_CHECK_SITE_KEY and restart the frontend.',
    );
    reportRecommendationFailure(error, 'missing-app-check-configuration');
    throw error;
  }

  const profile = normalizeStudentProfile(studentProfile);
  const hasProfileInformation = Boolean(
    profile.degree
    || profile.branch
    || profile.skills.length
    || profile.interests.length
    || profile.projects.some((project) => project.name || project.description || project.technologies)
    || profile.certifications.some((certification) => certification.name || certification.issuer)
    || profile.experienceLevel,
  );
  if (!hasProfileInformation) {
    throw new CareerRecommendationError('Your saved profile is empty. Add some education, skills, interests, projects, or experience in Student Profile first.');
  }
  if (activeGeneration) {
    throw new CareerRecommendationError('A recommendation request is still processing. Please wait for it to finish before retrying.');
  }

  const prompt = [
    'You are a practical career guide for college students.',
    'Recommend career paths based only on the student context below. Do not promise a job or invent credentials.',
    'Return 3 to 5 distinct career paths in the provided JSON schema. Give compatibility scores as integers from 0 to 100; they are directional estimates, not hiring predictions.',
    'For each path, explain why it suits the student, identify relevant existing skills and missing or recommended skills, assign every missing skill a Beginner, Intermediate, or Advanced learning priority based on prerequisites, and give a sequenceOrder starting at 1 that puts foundational skills first. Give a beginner-friendly phased roadmap, propose one portfolio project, and list concrete next steps.',
    'Do not include the student name, email address, or unsupported claims.',
    `Student context: ${JSON.stringify(profile)}`,
  ].join('\n\n');

  let timeoutId;
  try {
    const request = generativeModel.generateContent(prompt);
    activeGeneration = request;
    request.then(
      () => { if (activeGeneration === request) activeGeneration = null; },
      () => { if (activeGeneration === request) activeGeneration = null; },
    );
    const result = await Promise.race([
      request,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new CareerRecommendationError(
          'The AI service is taking too long to respond. Please wait briefly and retry.',
        )), 45000);
      }),
    ]);
    const responseText = result.response.text();
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new CareerRecommendationError(
        'Gemini returned malformed JSON. Please try the recommendation request again.',
        { cause: error },
      );
    }

    return validateRecommendations(parsedResponse);
  } catch (error) {
    reportRecommendationFailure(error);
    if (error instanceof CareerRecommendationError) throw error;
    throw new CareerRecommendationError(
      'Career recommendations are unavailable right now. Check your connection and Firebase AI Logic setup, then retry.',
      { cause: error },
    );
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function useCareerRecommendations() {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);

  async function requestRecommendations(studentProfile) {
    if (requestInFlight.current) return null;
    requestInFlight.current = true;
    setLoading(true);
    setError('');
    setRecommendations(null);

    try {
      const result = await generateCareerRecommendations(studentProfile);
      setRecommendations(result);
      return result;
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : 'Career recommendations could not be generated. Please try again.';
      setError(message);
      return null;
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }

  return { recommendations, loading, error, requestRecommendations };
}
