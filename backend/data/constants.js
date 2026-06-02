// Domain constants that used to live as statics on the Mongoose models.
// Kept in one place now that the models are gone.

const NUST_DOMAINS = [
  'nust.edu.pk', 'student.nust.edu.pk',
  'seecs.edu.pk',
  'smme.nust.edu.pk', 'scme.nust.edu.pk', 'scee.nust.edu.pk',
  'sns.nust.edu.pk',  's3h.nust.edu.pk',  'nbs.nust.edu.pk',
  'sese.nust.edu.pk', 'sada.nust.edu.pk', 'sines.nust.edu.pk',
  'asab.nust.edu.pk',
];

const POST_TAGS = ['Academic Help', 'Career & Internships', 'Resources', 'Events & Societies'];

const REPORT_TYPES   = ['post', 'user', 'resource'];
const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate', 'Misinformation'];

module.exports = { NUST_DOMAINS, POST_TAGS, REPORT_TYPES, REPORT_REASONS };
