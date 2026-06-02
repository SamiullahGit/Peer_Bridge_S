// One-shot seeder for Supabase/Postgres: clears every table and re-inserts
// the canonical NUST demo data (same dataset as the old Mongo seed).
//
// Usage: npm run seed
//
// All passwords are bcrypted "Test@123".
//
// Relationship wiring: users and posts get client-generated UUIDs so the
// 1-based index helpers (u(n), p(n)) work exactly like the old seed.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt       = require('bcryptjs');
const { randomUUID } = require('crypto');
const { supabase } = require('../config/supabase');

// supabase-js refuses an unfiltered delete; this matches every real row.
const ALL = ['id', '00000000-0000-0000-0000-000000000000'];

async function clearTable(name) {
  const { error } = await supabase.from(name).delete().neq(...ALL);
  if (error) throw new Error(`clear ${name}: ${error.message}`);
}

async function insert(name, rows) {
  const { error } = await supabase.from(name).insert(rows);
  if (error) throw new Error(`insert ${name}: ${error.message}`);
}

async function run() {
  console.log('  Clearing tables...');
  // Child tables first (FKs are ON DELETE CASCADE, but explicit is clearer).
  for (const t of [
    'xp_notifications', 'xp_transactions', 'certificates', 'reports',
    'events', 'resources', 'ratings', 'messages', 'mentorship_requests',
    'post_bookmarks', 'post_likes', 'replies', 'posts', 'users',
  ]) {
    await clearTable(t);
  }

  const pw = await bcrypt.hash('Test@123', 10);

  // ── Users (15 NUST students + mentors) ─────────────────────────────
  const userData = [
    { name: 'Syed Hassan Raza',    email: 'syed.hassan@nust.edu.pk',               role: 'mentor',  department: 'SEECS', graduation_year: 2023, bio: 'CS grad now at Google Singapore. Distributed systems and ML. Helped 60+ students with FYPs, FAANG prep, and research. Available for anything CS-related.', rating: 4.95, rating_count: 61, sessions_count: 68 },
    { name: 'Aiman Batool',        email: 'aiman.batool@nust.edu.pk',              role: 'mentor',  department: 'NBS',   graduation_year: 2022, bio: 'NBS grad, MBA from LUMS, currently at McKinsey Karachi. I mentor on case interviews, MBA applications, and corporate finance. 70+ students placed in Big 4 and MNCs.', rating: 4.90, rating_count: 74, sessions_count: 82 },
    { name: 'Areeba Noor',         email: 'areeba.noor@nust.edu.pk',               role: 'mentor',  department: 'SEECS', graduation_year: 2022, bio: 'MS at LUMS, IEEE-published researcher in NLP and HCI. If you are targeting top grad programs or research positions, I can help you build a strong profile.', rating: 4.88, rating_count: 55, sessions_count: 60 },
    { name: 'Muhammad Usman',      email: 'm.usman@nust.edu.pk',                   role: 'mentor',  department: 'SEECS', graduation_year: 2024, bio: 'Backend engineer at Systems Limited. Competitive programming and open source background. Available for DSA prep, internship referrals, and tech interview coaching.', rating: 4.75, rating_count: 33, sessions_count: 38 },
    { name: 'Hira Baig',           email: 'hira.baig@nust.edu.pk',                 role: 'mentor',  department: 'S3H',   graduation_year: 2024, bio: 'English Lit grad, now HR at Unilever Pakistan. I help with CVs, LinkedIn, and soft skills for non-technical corporate career paths.', rating: 4.70, rating_count: 22, sessions_count: 27 },
    { name: 'Talha Iqbal',         email: 'talha.iqbal@nust.edu.pk',               role: 'mentor',  department: 'SMME',  graduation_year: 2023, bio: 'Mechanical engineer at NESCOM working on aerospace systems. I guide SMME students on FYPs, SolidWorks CAD, and defence sector paths. Formula Student alumnus.', rating: 4.65, rating_count: 18, sessions_count: 22 },
    { name: 'Sana Mirza',          email: 'sana.mirza@nust.edu.pk',                role: 'mentor',  department: 'SEECS', graduation_year: 2025, bio: 'Currently doing MS at FAST-NUCES. Undergrad research in computer vision. Coaching students on SEECS FYP proposals and research paper writing. Available evenings.', rating: 4.60, rating_count: 14, sessions_count: 16 },
    { name: 'Omar Farooq',         email: 'omar.farooq@nust.edu.pk',               role: 'mentor',  department: 'CEME',  graduation_year: 2024, bio: 'Electrical engineer at PTCL. Interned at Telenor and Jazz. Good for CEME and SEECS students targeting telecom and power sector careers.', rating: 4.55, rating_count: 11, sessions_count: 13 },
    { name: 'Zainab Fatima',       email: 'zainab.fatima@student.nust.edu.pk',     role: 'student', department: 'SEECS', graduation_year: 2026, bio: 'Final-year CS student. FYP in deep learning for medical imaging. President, IEEE NUST WIE chapter 2025-26.' },
    { name: 'Abdullah Malik',      email: 'abdullah.malik@student.nust.edu.pk',    role: 'student', department: 'NBS',   bio: 'Third-year finance student on the NUST Job Fair 2026 organizing team. Interested in investment banking and equity research.' },
    { name: 'Mahnoor Qureshi',     email: 'mahnoor.qureshi@student.nust.edu.pk',   role: 'student', department: 'SEECS', bio: 'Second-year BS CS. Top 10 at NASCON 2026 speed programming. Looking for summer research internships in AI/ML.' },
    { name: 'Hamza Sheikh',        email: 'hamza.sheikh@student.nust.edu.pk',      role: 'student', department: 'SMME',  bio: 'ME sophomore on the NUST Formula Student aerodynamics sub-team. Passionate about automotive design and electric vehicles.' },
    { name: 'Rimsha Asif',         email: 'rimsha.asif@student.nust.edu.pk',       role: 'student', department: 'SEECS', bio: 'First-semester CS at SEECS. Navigating MTH-101 and CS-101 at the same time. Long-term interest in cybersecurity.' },
    { name: 'Owais Ahmed',         email: 'owais.ahmed@student.nust.edu.pk',       role: 'student', department: 'NBS',   bio: 'First semester at NBS. Looking for the right societies and study groups. Open to all mentorship.' },
    { name: 'Mariam Iftikhar',     email: 'mariam.iftikhar@student.nust.edu.pk',   role: 'student', department: 'SCME',  bio: 'Chemical engineering junior, research project on water purification. Member of NUST Literary Society.' },
  ];

  const users = userData.map(u => ({
    id: randomUUID(),
    ...u,
    password_hash : pw,
    is_verified   : true,
    rating        : u.rating        || 0,
    rating_count  : u.rating_count  || 0,
    sessions_count: u.sessions_count || 0,
  }));
  await insert('users', users);
  console.log(`  Inserted ${users.length} users`);

  const u = (n) => users[n - 1].id;   // 1-based, mirrors the old SQL ID layout

  // ── Posts ──────────────────────────────────────────────────────────
  const postData = [
    { author_id: u(13), tag: 'Academic Help',        title: 'Drowning in MTH-101 and CS-101 simultaneously - any survival tips for SEECS freshmen?', body: 'Week 3 of SEECS and I genuinely feel like I am drowning. MTH-101 moves so fast and CS-101 lab feels like a completely different subject from the lectures. Is this normal? How did you seniors manage both? Any particular resources that saved you?', likes_count: 47, comments_count: 2, bookmarks_count: 12 },
    { author_id: u(11), tag: 'Resources',            title: 'Complete CS-201 Data Structures notes - midterm and final content, all in one PDF', body: 'Compiled from lectures, Cormen, and Geeks for Geeks summaries aligned to the SEECS syllabus. Covers arrays, linked lists, stacks, queues, trees (BST, AVL, Heap), graphs (BFS, DFS, Dijkstra), hashing, and DP basics. Resource uploaded above.', likes_count: 183, comments_count: 1, bookmarks_count: 142 },
    { author_id: u(9),  tag: 'Academic Help',        title: 'FYP pro tip: finish your literature review in the first two weeks of semester 7, not the last two', body: 'I see the same mistake every year. Students spend weeks 1-6 "planning" then panic-read 30 papers in week 11. A literature review done properly takes three full weeks. Start on day one. Define your gap by week 2. Your supervisor will respect you for it and your proposal will be incomparably stronger.', likes_count: 211, comments_count: 2, bookmarks_count: 98 },
    { author_id: u(10), tag: 'Career & Internships', title: 'My McKinsey Pakistan OA experience: what to expect and how I actually prepared', body: 'Just cleared the McKinsey Online Assessment. The Solve game now runs 50 minutes, not 35 like older guides say. Three mini-games test systems thinking, data interpretation, and pattern recognition. I used the free McKinsey practice portal every day for two weeks. The written case that follows is harder - message me for resources.', likes_count: 94, comments_count: 2, bookmarks_count: 67 },
    { author_id: u(11), tag: 'Events & Societies',   title: 'NASCON 2026 recap - SEECS students dominate the speed programming leaderboard again', body: 'NASCON wrapped up last month and it was the best edition yet. The competitive programming track had 340 registered teams. Top 10 was dominated by SEECS second and third years. The hackathon track was new this year - our team built an Urdu NLP tool and won runner-up. Full results on the NASCON website. See you at NASCON 2027!', likes_count: 78, comments_count: 1, bookmarks_count: 5 },
    { author_id: u(12), tag: 'Events & Societies',   title: 'NUST Formula Student 2026 car reveal - Friday at SMME courtyard, 11am', body: 'Three years of work. The FS26 is fully electric, has a new composite monocoque, and the aero package is the most refined we have ever built. Come support the team this Friday at 11am at the SMME courtyard. Free entry, open to everyone. Bring your questions for the engineering team.', likes_count: 113, comments_count: 2, bookmarks_count: 8 },
    { author_id: u(14), tag: 'Academic Help',        title: 'Which NBS societies are actually worth joining in first year?', body: 'I keep hearing "join everything in first year" but also "over-committing kills your GPA in semester 1." How did NBS seniors actually balance this? Which one or two societies gave the most return in terms of skills, network, and career visibility?', likes_count: 52, comments_count: 2, bookmarks_count: 19 },
    { author_id: u(1),  tag: 'Career & Internships', title: 'From SEECS to Google Singapore: what I wish I had known in second year', body: 'A lot of students ask how I got to Google. The honest answer: I stopped doing competitive programming to score marks and started building real projects people could use. Open source contributions got me my first international internship. Your GitHub is your real CV. Build something, put it online, talk about it. I will write a detailed post later but start there.', likes_count: 267, comments_count: 2, bookmarks_count: 189 },
    { author_id: u(15), tag: 'Resources',            title: 'SCME CHE-201 Thermodynamics - full semester notes and past papers (2022-2025)', body: 'Compiled from lecture slides and Cengel & Boles, with three years of past papers and worked solutions for all numericals. Covers laws of thermodynamics, entropy, heat engines, refrigeration cycles, and power plant analysis. Good luck everyone.', likes_count: 144, comments_count: 1, bookmarks_count: 118 },
    { author_id: u(10), tag: 'Events & Societies',   title: 'NUST Job Fair 2026: 120+ companies confirmed - full list and preparation tips inside', body: 'May 6-7 at CIE Sports Complex. 120+ companies this year: Engro, P&G, Google, Systems Limited, HBL, Meezan Bank, PTCL, Jazz, Arbisoft, 10Pearls, Oracle Pakistan, and more. Formal dress is mandatory. Bring at least 15 printed CVs. Company-by-company prep guide posted on the NBS Consulting Cell portal. Tag your friends.', likes_count: 156, comments_count: 3, bookmarks_count: 201 },
    { author_id: u(13), tag: 'Academic Help',        title: 'PHY-101 lab report format - what does a full-marks error analysis actually look like?', body: 'My TA said my error analysis lacks depth but I do not know what depth means here. I wrote the percentage error formula and plugged in numbers. What else is expected? Is there a standard format NUST TAs look for?', likes_count: 31, comments_count: 1, bookmarks_count: 44 },
    { author_id: u(5),  tag: 'Career & Internships', title: "CV mistakes that got NUST graduates rejected by Unilever and P&G - a recruiter's perspective", body: 'I screened over 400 NUST graduate CVs in the past year. Top five mistakes causing instant rejection: (1) Generic objective statement. (2) Listing societies without saying what you did. (3) No quantified achievements - "managed social media" is not a bullet, "grew Instagram followers 3x in 4 months" is. (4) GPA below 3.2 with nothing to offset it. (5) Two-page CVs with nothing worth a second page. Fix these first.', likes_count: 198, comments_count: 2, bookmarks_count: 87 },
  ];
  const posts = postData.map(p => ({ id: randomUUID(), ...p }));
  await insert('posts', posts);
  const p = (n) => posts[n - 1].id;
  console.log(`  Inserted ${posts.length} posts`);

  // ── Replies ────────────────────────────────────────────────────────
  await insert('replies', [
    { post_id: p(1),  author_id: u(7),  text: 'Make a timetable and treat CS-101 lab and MTH-101 as completely separate study blocks. The first three weeks are the hardest before you find your rhythm. Form a study group of 3-4 people in week 1 - do not wait until you are falling behind. The SEECS senior batch shares notes through a departmental group, ask someone to add you.', likes_count: 31 },
    { post_id: p(1),  author_id: u(1),  text: 'Use MIT 6.001 on YouTube for CS-101 fundamentals - far better than reading the textbook alone. For MTH-101, Stewart Calculus Chapters 1-3 covers the entire first midterm. Study limits visually on Khan Academy first, then solve NUST past papers for exam technique. Past papers are more useful than any notes.', likes_count: 44 },
    { post_id: p(2),  author_id: u(4),  text: 'Quality notes. One addition: for dynamic programming, lecture content barely scratches what finals can ask. Use CLRS Chapter 15 alongside this. Classic problems like LCS, Knapsack, and Matrix Chain Multiplication have appeared in NUST CS-201 finals every year for the last four years.', likes_count: 27 },
    { post_id: p(3),  author_id: u(3),  text: 'This deserves to be pinned. I would add: use Zotero from day one to manage your references. Students who build their reference library early save 10-15 hours during final submission. Also define your gap statement in one sentence before week 3 - if you cannot state the gap in one sentence, your literature review is not done yet.', likes_count: 56 },
    { post_id: p(3),  author_id: u(7),  text: 'Also: talk to your supervisor every single week even when you have nothing to show. Build the relationship before you have a problem, not during one. Supervisors are far more forgiving of setbacks when they trust your consistency.', likes_count: 38 },
    { post_id: p(4),  author_id: u(2),  text: 'Good write-up. The Imbellus Solve game changed format in late 2025 - now 50 minutes with a clearer scoring breakdown. Mental math still matters a lot. Key tip: do not rush the ecosystem game. Students who click fast score worse than those who observe patterns first. Message me if you want the practice link I used.', likes_count: 41 },
    { post_id: p(4),  author_id: u(15), text: 'Did you prepare alone or in a study group? I am attempting this cycle and would love a structured prep partner.', likes_count: 8 },
    { post_id: p(5),  author_id: u(4),  text: 'The hackathon judging was noticeably more structured this year - actual rubrics instead of subjective evaluation. The SEECS CP team has been strong for years now. NASCON 2027 should seriously consider adding a CTF cybersecurity track, the demand is clearly there.', likes_count: 19 },
    { post_id: p(6),  author_id: u(6),  text: 'The team went through three complete design revisions this year. Switching from combustion to full electric was the highest-risk call since 2021 and the students delivered. Come support them on Friday - they have earned it.', likes_count: 48 },
    { post_id: p(6),  author_id: u(3),  text: 'Will the powertrain architecture documentation be made publicly available after the reveal? Interested in the motor control logic for a potential embedded systems collaboration with SEECS.', likes_count: 12 },
    { post_id: p(7),  author_id: u(5),  text: 'From an HR perspective: join one or two societies you will actually show up for, not five for the certificates. Recruiters can tell the difference in 30 seconds of an interview. At NBS specifically, the Finance Club and the Consulting Cell have the best alumni networks. Choose based on where you want to be in year four.', likes_count: 34 },
    { post_id: p(7),  author_id: u(2),  text: 'NBS Consulting Cell and Model UN were genuinely transformative for me. Both have senior members who actively push your growth. My rule: do not over-join in semester 1. Lock in your academic rhythm first. You can always join more in semester 2 once you know your capacity.', likes_count: 29 },
    { post_id: p(8),  author_id: u(11), text: 'Saving this forever. The open source point is something nobody says out loud in second year - everyone just talks about competitive programming ratings. Changing my approach this semester.', likes_count: 72 },
    { post_id: p(8),  author_id: u(13), text: 'This is exactly what I needed as a freshman. Thank you. Already following you on LinkedIn. Is there a beginner open source project you would recommend starting with?', likes_count: 38 },
    { post_id: p(9),  author_id: u(12), text: 'Any chance you have ME-201 Engineering Mechanics notes as well? Finals are in three weeks and the Hibbeler textbook is very dense to follow under exam pressure.', likes_count: 11 },
    { post_id: p(10), author_id: u(9),  text: 'IEEE NUST will have a booth this year with live project demonstrations. Come visit - we are also quietly recruiting for the 2026-27 committee. Look for the blue banner near the CIE main entrance.', likes_count: 27 },
    { post_id: p(10), author_id: u(7),  text: 'Practical tip from last year: bring at least 15 printed CVs. Serious MNC booths go through stacks fast. By 11am last year some students had run out. Also wear formal - the big company booths absolutely notice and it affects first impressions more than people expect.', likes_count: 53 },
    { post_id: p(10), author_id: u(14), text: 'Is this open for freshmen? I do not have an internship-ready CV yet. Is it worth attending just to explore companies and talk to people?', likes_count: 6 },
    { post_id: p(11), author_id: u(7),  text: 'NUST PHY-101 lab reports follow this structure: Objective, Theory, Apparatus, Procedure, Observations Table, Sample Calculations, Graph, Results, Error Analysis, Conclusion. For error analysis: calculate percentage error, then write two sentences on likely sources of error (instrument precision, reaction time, environmental factors). That is what "depth" means to your TA.', likes_count: 49 },
    { post_id: p(12), author_id: u(9),  text: 'The generic objective point is so real. Every CV I review from freshmen opens with "to obtain a challenging position that leverages my skills." Remove it and replace it with a two-line targeted summary tied to the specific role. Hiring managers read CVs in 6-8 seconds on first pass - your first two lines decide if they continue.', likes_count: 67 },
    { post_id: p(12), author_id: u(10), text: 'Sharing with my whole batch. I genuinely did not know the GPA threshold was 3.2 for most MNCs. Always assumed 3.0 was fine.', likes_count: 15 },
  ]);
  console.log('  Inserted replies');

  // ── Events ─────────────────────────────────────────────────────────
  await insert('events', [
    { organizer_id: u(11), title: 'NASCON 2026 - NUST Annual Student Competition',           description: "Pakistan's largest student computing competition. 340+ teams across speed programming, hackathon, robotics, gaming, and project showcase tracks.", venue: 'SEECS Building, H-12 Campus',     event_date: '2026-03-14', event_time: '09:00:00', category: 'Competition' },
    { organizer_id: u(9),  title: 'NUST Sports Gala 2026',                                   description: 'Annual inter-school sports competition covering cricket, football, basketball, badminton, tennis, swimming, and athletics.',                                  venue: 'CIE Sports Complex, H-12',         event_date: '2026-03-06', event_time: '08:00:00', category: 'Sports' },
    { organizer_id: u(1),  title: 'SEECS Open Source Day 2026',                              description: 'Full-day event where SEECS students present open source projects and run workshops on Git, GitHub, and contributing to major open source repositories.',          venue: 'SEECS Auditorium, H-12',           event_date: '2026-04-05', event_time: '10:00:00', category: 'Technical' },
    { organizer_id: u(9),  title: 'IEEE NUST Annual General Body Meeting 2026',              description: 'IEEE NUST Student Branch AGM and committee elections for the 2026-27 academic year.',                                                                              venue: 'SEECS Conference Room, 3rd Floor', event_date: '2026-04-12', event_time: '15:00:00', category: 'Society' },
    { organizer_id: u(9),  title: 'NUST Blood Drive 2026',                                   description: 'Annual blood donation campaign organized by IEEE NUST WIE in collaboration with PIMS Hospital Islamabad.',                                                          venue: 'CIE Sports Complex, H-12',         event_date: '2026-04-30', event_time: '09:00:00', category: 'Community' },
    { organizer_id: u(10), title: 'NUST Job Fair 2026',                                      description: "One of Pakistan's largest campus recruitment events. 120+ companies across technology, finance, energy, FMCG, telecom, and consulting.",                            venue: 'CIE Sports Complex, H-12',         event_date: '2026-05-06', event_time: '09:00:00', category: 'Career' },
    { organizer_id: u(7),  title: 'Scintilla 2026 - SEECS Annual Technical Symposium',       description: 'SEECS flagship technical event. Two days of project exhibitions, industry talks, hands-on workshops, and networking.',                                              venue: 'SEECS Building, H-12',             event_date: '2026-05-13', event_time: '09:00:00', category: 'Technical' },
    { organizer_id: u(6),  title: 'NUST Formula Student 2026 - Public Demo Day',             description: 'Public demonstration of the FS26 electric race car built by the NUST Formula Student team over three years.',                                                       venue: 'SMME Courtyard, H-12 Campus',      event_date: '2026-05-17', event_time: '11:00:00', category: 'Technical' },
    { organizer_id: u(3),  title: 'SEECS FYP Showcase 2026',                                 description: 'Annual showcase of BS and MS Final Year Projects from SEECS. 80+ projects across AI, cybersecurity, embedded systems, HCI, and networks.',                          venue: 'SEECS Seminar Hall, H-12',         event_date: '2026-05-21', event_time: '09:00:00', category: 'Academic' },
    { organizer_id: u(15), title: 'NLS Annual Mushaira 2026',                                description: "NUST Literary Society's annual Urdu poetry night. Open mic for students, faculty readings, and guest poet performances.",                                          venue: 'CIE Main Lawn, H-12',              event_date: '2026-05-24', event_time: '18:00:00', category: 'Cultural' },
    { organizer_id: u(2),  title: 'NBS Business Case Competition 2026',                      description: 'NBS annual case competition open to all business and management students. Total prize pool PKR 200,000.',                                                            venue: 'NBS Auditorium, H-12',             event_date: '2026-05-28', event_time: '10:00:00', category: 'Competition' },
    { organizer_id: u(15), title: 'NUMUN 2026 - NUST Model United Nations',                  description: 'Three-day Model UN conference hosted by NUST. Fifteen committees covering international security, climate policy, economic development, and human rights.',          venue: 'Margalla Hall, H-12 Campus',       event_date: '2026-06-06', event_time: '08:00:00', category: 'Society' },
    { organizer_id: u(3),  title: 'NUST Research Day 2026',                                  description: 'Annual showcase of ongoing faculty and graduate research across all NUST schools.',                                                                                  venue: 'NUST Main Lawn and Auditorium',    event_date: '2026-06-12', event_time: '10:00:00', category: 'Academic' },
    { organizer_id: u(1),  title: 'E3 Summit 2026 - Entrepreneurship, Energy & Engineering', description: 'NUST annual entrepreneurship summit connecting student startups, venture capitalists, and industry leaders. Pitch competition with PKR 500,000 in funding prizes.', venue: 'CIE Auditorium, H-12',             event_date: '2026-06-19', event_time: '10:00:00', category: 'Career' },
  ]);
  console.log('  Inserted events');

  // ── Resources ──────────────────────────────────────────────────────
  await insert('resources', [
    { uploader_id: u(11), title: 'CS-201 Data Structures & Algorithms - Complete Notes',      description: 'Full semester notes covering arrays, linked lists, stacks, queues, trees (BST, AVL, Heap), graphs (BFS/DFS/Dijkstra), hashing, and dynamic programming.', file_name: 'cs201_dsa_notes.pdf',         file_type: 'PDF',  file_size: 4718592,  category: 'Course Notes',  course_code: 'CS-201',  downloads_count: 312 },
    { uploader_id: u(13), title: 'MTH-101 Calculus - Past Papers Bundle (2020-2025)',         description: '5 years of MTH-101 midterm and final exams with fully worked solutions.', file_name: 'mth101_papers_2020_25.zip',   file_type: 'ZIP',  file_size: 18874368, category: 'Past Papers',   course_code: 'MTH-101', downloads_count: 589 },
    { uploader_id: u(7),  title: 'PHY-101 - Solved Problem Sets and Lab Report Guide',        description: 'Solved numericals from Halliday/Resnick aligned to the NUST PHY-101 syllabus.', file_name: 'phy101_problems_labs.pdf', file_type: 'PDF',  file_size: 6291456,  category: 'Course Notes',  course_code: 'PHY-101', downloads_count: 417 },
    { uploader_id: u(1),  title: 'SEECS FYP Proposal Template 2026',                          description: 'Updated SEECS FYP proposal template with sections for problem statement, literature review matrix, methodology, timeline, and expected contributions.', file_name: 'seecs_fyp_template_2026.docx', file_type: 'DOCX', file_size: 1048576,  category: 'FYP Resources', course_code: null, downloads_count: 278 },
    { uploader_id: u(6),  title: 'SMME ME-201 Engineering Mechanics - Formula Sheet & Notes', description: 'One-page formula sheet and chapter-by-chapter notes covering statics and dynamics.', file_name: 'me201_mechanics_notes.pdf', file_type: 'PDF',  file_size: 3145728,  category: 'Course Notes',  course_code: 'ME-201',  downloads_count: 203 },
    { uploader_id: u(2),  title: 'NBS Case Interview Preparation Pack',                       description: 'Comprehensive case prep guide for McKinsey, BCG, Bain, and local consulting firms.', file_name: 'nbs_case_prep_pack.pdf',  file_type: 'PDF',  file_size: 8388608,  category: 'Career Guide',  course_code: null, downloads_count: 445 },
    { uploader_id: u(5),  title: 'CV and LinkedIn Guide for NUST Students (2026 Edition)',    description: 'Step-by-step CV writing guide for NUST students targeting MNCs, Big 4, and tech companies.', file_name: 'cv_linkedin_guide_2026.pdf', file_type: 'PDF',  file_size: 2097152,  category: 'Career Guide',  course_code: null, downloads_count: 521 },
    { uploader_id: u(15), title: 'SCME CHE-201 Thermodynamics - Notes and Past Papers',       description: 'Full semester notes from Cengel & Boles with three years of past papers.', file_name: 'che201_thermo_notes.zip',  file_type: 'ZIP',  file_size: 22020096, category: 'Course Notes',  course_code: 'CHE-201', downloads_count: 134 },
    { uploader_id: u(4),  title: 'HU-101 Technical Report Writing - Complete Guide',          description: 'Covers report structure, IEEE and APA citation formats, paragraph construction, and common grammatical errors in engineering writing.', file_name: 'hu101_writing_guide.pdf', file_type: 'PDF', file_size: 1572864, category: 'Course Notes',  course_code: 'HU-101', downloads_count: 267 },
    { uploader_id: u(3),  title: 'NUST Graduate School Application Guide (MS/PhD 2026)',      description: 'Covers NUST MS and PhD application process, SOP writing with annotated examples, referee selection strategy, CGPA benchmarks by department, and timeline planning.', file_name: 'nust_grad_guide_2026.pdf', file_type: 'PDF', file_size: 3670016, category: 'FYP Resources', course_code: null, downloads_count: 189 },
  ]);
  console.log('  Inserted resources');

  // ── Ratings ────────────────────────────────────────────────────────
  await insert('ratings', [
    { rater_id: u(9),  mentor_id: u(1), score: 5, comment: 'Syed bhai spent two hours on a call walking me through my FYP architecture. Genuinely changed the direction of my project for the better. Best mentor I have had.' },
    { rater_id: u(10), mentor_id: u(2), score: 5, comment: "Aiman's case prep sessions are the real deal. She knows exactly what McKinsey Pakistan looks for. Got through to the final round because of her." },
    { rater_id: u(11), mentor_id: u(3), score: 5, comment: 'Areeba reviewed my research proposal and gave comments sharper than any professor feedback I have received. Essential for anyone going into research.' },
    { rater_id: u(11), mentor_id: u(4), score: 4, comment: 'Very accessible and gives practical advice. His Systems Limited referral got me the interview. Would love more structured sessions but the quality is high.' },
    { rater_id: u(13), mentor_id: u(4), score: 5, comment: 'Muhammad bhai made CS-101 click in one session. Patient, clear, and gives the kind of real examples that textbooks skip.' },
    { rater_id: u(14), mentor_id: u(5), score: 4, comment: 'Hira helped me completely rewrite my CV and it is now actually good. She is direct about what needs to change which I really appreciated.' },
    { rater_id: u(10), mentor_id: u(5), score: 5, comment: 'Best career mentor at NUST for non-technical paths. Knows the MNC recruitment pipeline inside out.' },
    { rater_id: u(12), mentor_id: u(6), score: 5, comment: 'Talha bhai is the reason I joined Formula Student. Took time to explain the full design process and shared documentation I could not find anywhere else.' },
    { rater_id: u(9),  mentor_id: u(7), score: 4, comment: 'Sana is knowledgeable about the research process and helped me write my first abstract. Responsive and genuinely helpful.' },
    { rater_id: u(15), mentor_id: u(3), score: 5, comment: "Areeba ma'am's guidance on my SOP was invaluable. The before and after were completely different documents." },
  ]);
  console.log('  Inserted ratings');

  // ── Mentorship requests ────────────────────────────────────────────
  await insert('mentorship_requests', [
    { requester_id: u(13), mentor_id: u(1), message: 'Assalamu alaikum. I am a SEECS freshman interested in cybersecurity long-term and struggling with CS-101 right now. Could you point me in the right direction for first year?', status: 'accepted' },
    { requester_id: u(14), mentor_id: u(2), message: 'I am a first-year NBS student interested in consulting. I would love guidance on what to focus on in the first two years to be competitive for firms like McKinsey later.',         status: 'pending'  },
    { requester_id: u(11), mentor_id: u(3), message: 'I want to apply for MS programs next year. My CGPA is 3.7 and I have one conference paper accepted. Would you be willing to review my research statement?',                       status: 'accepted' },
    { requester_id: u(12), mentor_id: u(6), message: 'I just joined the Formula Student aerodynamics sub-team as a freshman. Any advice on the design review presentation and where to start with CFD?',                                status: 'accepted' },
    { requester_id: u(15), mentor_id: u(7), message: 'I am a junior working on a water purification research project. Looking for guidance on structuring my methodology and potentially writing it up for publication.',                status: 'pending'  },
    { requester_id: u(14), mentor_id: u(5), message: 'I am applying for MNC internships next cycle and my CV needs serious work. Would you be available for a CV review session?',                                                       status: 'pending'  },
  ]);
  console.log('  Inserted mentorship requests');

  // ── Messages ───────────────────────────────────────────────────────
  await insert('messages', [
    { sender_id: u(13), receiver_id: u(1),  text: 'Assalamu alaikum sir! Just sent a mentorship request. I am struggling a lot with CS-101 this semester and would really value some guidance on where to start.', is_read: true },
    { sender_id: u(1),  receiver_id: u(13), text: 'Wa alaikum salam Rimsha! Accepted your request. CS-101 is genuinely hard in week 1 - it gets easier. Start with Python Tutor (pythontutor.com) to visualize every loop and recursion. I will send you a full resource list this evening.', is_read: true },
    { sender_id: u(13), receiver_id: u(1),  text: 'Thank you so much! I just made an account on Python Tutor and it is already helping a lot with understanding how loops work.', is_read: true },
    { sender_id: u(12), receiver_id: u(6),  text: 'Sir, I just joined the Formula Student aero sub-team. Any tips for the design review presentation? I have basically no CFD experience yet.', is_read: true },
    { sender_id: u(6),  receiver_id: u(12), text: 'Great choice Hamza! For design review: know your drag coefficient calculation inside out and be ready to justify every single geometry decision. Use ANSYS Fluent for CFD - the SMME lab has licensed copies. I am sharing our 2023 design report with you right now.', is_read: true },
    { sender_id: u(11), receiver_id: u(3),  text: "Ma'am, I wanted to ask about MS applications. My CGPA is 3.7 and I have a paper accepted at a regional IEEE conference. Am I competitive for LUMS CS or SEECS MS programs?", is_read: true },
    { sender_id: u(3),  receiver_id: u(11), text: '3.7 CGPA with an accepted IEEE paper is a solid profile for both. The differentiator now is your SOP - it needs to tell a research story, not a CV in paragraph form. Email two or three professors in your target department before submitting the application. I can review your SOP draft when you have a version ready.', is_read: true },
    { sender_id: u(11), receiver_id: u(3),  text: 'This is incredibly helpful, thank you! I will draft the SOP this week and send it over.', is_read: false },
  ]);
  console.log('  Inserted messages');

  console.log('\n  Seed complete. All passwords are: Test@123\n');
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
