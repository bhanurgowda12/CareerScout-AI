function profileText(value) {
  return typeof value === 'string' ? value : '';
}

export function createEducationFromProfile(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const undergraduate = {
    level: 'Undergraduate degree',
    institution: profileText(source.college),
    board: '',
    qualification: profileText(source.degree),
    specialization: profileText(source.branch),
    startYear: '',
    completionYear: profileText(source.graduationYear),
    grade: '',
  };
  const hasProfileEducation = [
    undergraduate.institution,
    undergraduate.qualification,
    undergraduate.specialization,
    undergraduate.completionYear,
  ].some((value) => value.trim());

  return hasProfileEducation ? [undergraduate] : [];
}

export function getVisibleEducationEntries(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => Object.values(entry).some((value) => typeof value === 'string' && value.trim()))
    .sort((first, second) => {
      const year = (entry) => Number(entry.completionYear || entry.startYear) || 0;
      return year(second.entry) - year(first.entry) || first.index - second.index;
    })
    .map(({ entry }) => entry);
}