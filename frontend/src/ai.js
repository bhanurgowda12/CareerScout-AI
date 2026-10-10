import { useState } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { firebaseApp } from './firebase.js';

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
          reasoning: { type: 'string' },
          missingSkills: { type: 'array', items: { type: 'string' } },
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
          suggestedProjectIdeas: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'careerPath',
          'compatibilityScore',
          'reasoning',
          'missingSkills',
          'learningRoadmap',
          'suggestedProjectIdeas',
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
      model: 'gemini-2.5-flash',
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

function normalizeStudentProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new CareerRecommendationError('Provide a student profile to request recommendations.');
  }

  const education = profile.education && typeof profile.education === 'object'
    ? profile.education
    : {};

  return {
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    education: {
      degree: education.degree ?? '',
      branch: education.branch ?? education.specialization ?? '',
      college: education.college ?? education.collegeName ?? '',
      graduationYear: education.graduationYear ?? '',
    },
    projects: Array.isArray(profile.projects)
      ? profile.projects.map((project) => ({
        name: project?.name ?? '',
        description: project?.description ?? '',
        technologies: project?.technologies ?? project?.technologiesUsed ?? '',
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
    && typeof recommendation.reasoning === 'string'
    && isStringArray(recommendation.missingSkills)
    && Array.isArray(recommendation.learningRoadmap)
    && recommendation.learningRoadmap.every((phase) => (
      phase
      && typeof phase.phase === 'string'
      && typeof phase.timeframe === 'string'
      && isStringArray(phase.actions)
    ))
    && isStringArray(recommendation.suggestedProjectIdeas)
  ));

  if (value.careerRecommendations.length === 0 || !validRecommendations) {
    throw new CareerRecommendationError('Gemini returned incomplete or invalid recommendations. Please try again.');
  }

  return value;
}

export async function generateCareerRecommendations(studentProfile) {
  if (!generativeModel) {
    throw new CareerRecommendationError(
      'Firebase is not configured. Add the Firebase Vite environment values and restart the frontend.',
    );
  }

  const profile = normalizeStudentProfile(studentProfile);
  const prompt = [
    'You are a practical career guide for college students.',
    'Recommend career paths based only on the student context below. Do not promise a job or invent credentials.',
    'Return a JSON object matching the provided response schema. Give compatibility scores as integers from 0 to 100.',
    'Make the learning roadmap actionable and sequence it from foundational to advanced steps.',
    `Student context: ${JSON.stringify(profile)}`,
  ].join('\n\n');

  try {
    const result = await generativeModel.generateContent(prompt);
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
    if (error instanceof CareerRecommendationError) throw error;
    throw new CareerRecommendationError(
      'Career recommendations could not be generated. Check Firebase AI Logic setup and try again.',
      { cause: error },
    );
  }
}

export function useCareerRecommendations() {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function requestRecommendations(studentProfile) {
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
      setLoading(false);
    }
  }

  return { recommendations, loading, error, requestRecommendations };
}
