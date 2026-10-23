export const APPLICATION_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Other'];
export const MAX_DESCRIPTION_LENGTH = 1500;
export const MAX_NOTES_LENGTH = 2000;

const SUBMITTED_STATUSES = new Set(['Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn']);

export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateApplicationFields(fields) {
  const errors = {};
  const companyName = typeof fields?.companyName === 'string' ? fields.companyName.trim() : '';
  const jobTitle = typeof fields?.jobTitle === 'string' ? fields.jobTitle.trim() : '';
  const jobUrl = typeof fields?.jobUrl === 'string' ? fields.jobUrl.trim() : '';

  if (!companyName) errors.companyName = 'Enter a company name.';
  if (!jobTitle) errors.jobTitle = 'Enter a job title.';
  if (!APPLICATION_STATUSES.includes(fields?.status)) errors.status = 'Choose an application status.';
  if (jobUrl && !isValidHttpUrl(jobUrl)) errors.jobUrl = 'Enter a valid HTTP or HTTPS URL.';
  if (fields?.employmentType && !EMPLOYMENT_TYPES.includes(fields.employmentType)) {
    errors.employmentType = 'Choose a listed employment type.';
  }
  for (const field of ['dateApplied', 'followUpDate']) {
    if (fields?.[field] && !isValidDateString(fields[field])) errors[field] = 'Enter a valid date.';
  }
  if ((fields?.description?.length || 0) > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Use ${MAX_DESCRIPTION_LENGTH.toLocaleString()} characters or fewer.`;
  }
  if ((fields?.notes?.length || 0) > MAX_NOTES_LENGTH) {
    errors.notes = `Use ${MAX_NOTES_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return errors;
}

export function filterApplications(applications, searchText = '', status = 'All') {
  const search = typeof searchText === 'string' ? searchText.trim().toLocaleLowerCase() : '';
  return applications.filter((application) => {
    const matchesStatus = status === 'All' || application.status === status;
    const company = typeof application.companyName === 'string' ? application.companyName.toLocaleLowerCase() : '';
    const title = typeof application.jobTitle === 'string' ? application.jobTitle.toLocaleLowerCase() : '';
    return matchesStatus && (!search || company.includes(search) || title.includes(search));
  });
}

export function getApplicationSummary(applications) {
  const uniqueApplications = [...new Map(applications.map((application, index) => [
    application.id || `application-${index}`,
    application,
  ])).values()];
  return {
    total: uniqueApplications.length,
    submitted: uniqueApplications.filter((application) => SUBMITTED_STATUSES.has(application.status)).length,
    interviews: uniqueApplications.filter((application) => application.status === 'Interview').length,
    offers: uniqueApplications.filter((application) => application.status === 'Offer').length,
  };
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFollowUpState(value, today = getLocalDateString()) {
  if (!isValidDateString(value) || !isValidDateString(today)) return 'none';
  return value < today ? 'overdue' : 'upcoming';
}

function savedTime(application) {
  const value = application.dateSaved;
  const date = value && typeof value.toDate === 'function'
    ? value.toDate()
    : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function sortApplications(applications, sortBy = 'newest') {
  return applications
    .map((application, index) => ({ application, index }))
    .sort((first, second) => {
      let difference = 0;
      if (sortBy === 'followUp') {
        const firstDate = isValidDateString(first.application.followUpDate)
          ? first.application.followUpDate
          : '9999-12-31';
        const secondDate = isValidDateString(second.application.followUpDate)
          ? second.application.followUpDate
          : '9999-12-31';
        difference = firstDate.localeCompare(secondDate);
      } else {
        difference = savedTime(second.application) - savedTime(first.application);
      }
      return difference || first.index - second.index;
    })
    .map(({ application }) => application);
}
