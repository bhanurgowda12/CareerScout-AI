import { useRef, useState } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { appCheck, firebaseApp } from './firebase.js';
import {
  buildCareerRecommendation,
  createRuleBasedRecommendations as generateRuleBasedRecommendations,
  getCareerPathways,
  matchProfileToCareers,
} from './careerCatalog.js';

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

function safeDiagnosticMessage(value) {
  if (typeof value !== 'string') return undefined;
  const message = value
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  return message ? message.slice(0, 240) : undefined;
}

function reportRecommendationFailure(error, categoryOverride) {
  const source = error?.cause || error;
  const customErrorData = source?.customErrorData || source?.customData || {};
  const errorDetails = Array.isArray(customErrorData.errorDetails) ? customErrorData.errorDetails : [];
  const serviceErrorCode = errorDetails
    .map((detail) => detail?.reason || detail?.code)
    .find((code) => typeof code === 'string');
  const providerResponseError = customErrorData.response?.error || customErrorData.error;
  const responseErrorCode = providerResponseError?.code;
  const status = Number(
    customErrorData.response?.status
      || customErrorData.status
      || source?.status,
  );
  const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  const providerErrorMessage = safeDiagnosticMessage(providerResponseError?.message);
  const searchableText = [
    error?.message,
    source?.message,
    providerErrorMessage,
    responseErrorCode,
    serviceErrorCode,
    customErrorData.error?.type,
    ...errorDetails.flatMap((detail) => [detail?.reason, detail?.code, detail?.message]),
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const isTemporarilyUnavailable = httpStatus === 500
    || httpStatus === 503
    || /temporar(?:y|ily) unavailable|service unavailable|unavailable|overload|high demand|prefill[ _-]*queue|preempted/.test(searchableText);
  const isRateLimitOrQuota = httpStatus === 429
    || /rate[ -]?limit|quota|resource\.exhausted/.test(searchableText);
  const firebaseErrorCode = safeDiagnosticCode(source?.code || error?.code);
  const category = categoryOverride
    || (/app.?check|attest/.test(searchableText)
      ? 'app-check'
      : httpStatus === 401 || serviceErrorCode === 'UNAUTHENTICATED'
        ? 'authentication'
        : httpStatus === 403
          ? 'permission-denied'
          : isRateLimitOrQuota
            ? 'rate-limit-or-quota'
            : /billing/.test(searchableText)
              ? 'quota-or-billing'
            : firebaseErrorCode === 'api-not-enabled'
              ? 'firebase-ai-logic-disabled'
              : isTemporarilyUnavailable
                ? 'temporary-unavailability'
                : /timeout|taking|took too long/.test(searchableText)
                  ? 'timeout'
                  : /malformed json|invalid recommendations|unexpected format|parse-failed/.test(searchableText)
                    ? 'invalid-ai-response'
                    : 'request-error');

  console.error('[CareerScout AI] Recommendation request failed', {
    category,
    httpStatus,
    providerErrorMessage,
    firebaseErrorCode,
    serviceErrorCode: safeDiagnosticCode(serviceErrorCode),
    geminiErrorCode: safeDiagnosticCode(responseErrorCode),
  });
  return category;
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
    preferredWorkAreas: Array.isArray(profile.preferredWorkAreas) ? profile.preferredWorkAreas : [],
    preferredIndustries: Array.isArray(profile.preferredIndustries) ? profile.preferredIndustries : [],
    careerInterests: Array.isArray(profile.careerInterests) ? profile.careerInterests : [],
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
    throw new CareerRecommendationError('Recommendations were returned in an unexpected format. Please try again.');
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
    value.careerRecommendations.length < 1
    || value.careerRecommendations.length > 5
    || new Set(careerTitles).size !== careerTitles.length
    || !validRecommendations
  ) {
    throw new CareerRecommendationError('Recommendations were incomplete or invalid. Please try again.');
  }

  return value;
}

function createRuleBasedRecommendations(profile) {
  return generateRuleBasedRecommendations(profile);
}

let activeGeneration = null;

export async function generateCareerRecommendations(studentProfile) {
  const profile = normalizeStudentProfile(studentProfile);
  const hasProfileInformation = Boolean(
    profile.degree
    || profile.branch
    || profile.skills.length
    || profile.interests.length
    || profile.preferredWorkAreas.length
    || profile.preferredIndustries.length
    || profile.careerInterests.length
    || profile.projects.some((project) => project.name || project.description || project.technologies)
    || profile.certifications.some((certification) => certification.name || certification.issuer)
    || profile.experienceLevel,
  );
  if (!hasProfileInformation) {
    throw new CareerRecommendationError('Your saved profile is empty. Add education, skills, interests, projects, or experience in Student Profile first.');
  }

  const candidates = matchProfileToCareers(profile, 20);
  if (!candidates.length) {
    throw new CareerRecommendationError('Your profile does not yet contain enough career-related detail to make a relevant match. Add skills, interests, project work, or preferred work areas, then try again.');
  }

  if (!generativeModel) {
    return createRuleBasedRecommendations(profile);
  }

  if (!appCheck) {
    return createRuleBasedRecommendations(profile);
  }
  if (activeGeneration) {
    throw new CareerRecommendationError('A recommendation request is still processing. Please wait for it to finish before retrying.');
  }

  const prompt = [
    'You are a practical career guide for college students.',
    'You are ranking role options for a student. Use only the candidate roles listed below and the evidence in the saved profile. Do not invent qualifications, salary, hiring statistics, or employment outcomes.',
    'Return up to 5 distinct careerPath values exactly as written in the candidate list. Prefer roles with a concrete connection to the profile. If a role is weakly related, do not include it. Scores are directional estimates only and not hiring probabilities.',
    'Explain the relationship to actual profile details. Describe existing and transferable skills separately from skills the student would still need to learn. Give a beginner-friendly sequence and one practical, legal project idea.',
    'Do not include the student name or email address.',
    `Candidate roles and profile evidence: ${JSON.stringify(candidates.map((candidate) => ({
      title: candidate.title,
      domain: candidate.domainLabel,
      profileSkillMatches: candidate.skillMatches,
      projectMatches: candidate.projectMatches,
      interestMatches: candidate.interestMatches,
      workAreaMatches: candidate.workAreaMatches,
      pathways: getCareerPathways(candidate.id).map(({ id, label, focus, skills }) => ({ id, label, focus, skills })),
    })))}`,
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
          'The AI request took too long to respond. The service may be busy; please wait briefly and try again.',
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

    const validated = validateRecommendations(parsedResponse);
    const candidatesByTitle = new Map(candidates.map((candidate) => [candidate.title.toLocaleLowerCase(), candidate]));
    const enrichedRecommendations = validated.careerRecommendations
      .map((recommendation) => {
        const match = candidatesByTitle.get(recommendation.careerPath.trim().toLocaleLowerCase());
        if (!match) return null;
        const catalogueRecommendation = buildCareerRecommendation(match);
        return {
          ...catalogueRecommendation,
          whyItSuits: recommendation.whyItSuits,
          suggestedPortfolioProject: recommendation.suggestedPortfolioProject || catalogueRecommendation.suggestedPortfolioProject,
          nextSteps: recommendation.nextSteps.length ? recommendation.nextSteps : catalogueRecommendation.nextSteps,
        };
      })
      .filter(Boolean);
    if (!enrichedRecommendations.length) return createRuleBasedRecommendations(profile);

    return {
      careerRecommendations: enrichedRecommendations,
      generationMethod: 'gemini',
    };
  } catch (error) {
    const failureCategory = reportRecommendationFailure(error);
    if (['authentication', 'permission-denied', 'app-check'].includes(failureCategory)) {
      if (error instanceof CareerRecommendationError) throw error;
      throw new CareerRecommendationError('Firebase AI Logic could not authorize the recommendation request. Check your account and App Check configuration, then retry.', { cause: error });
    }
    return createRuleBasedRecommendations(profile);
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
