/**
 * eventContent.js
 *
 * Centralized official content for CyberHub Round 1 Technology Competition.
 * All values sourced directly from official club materials provided by the organizer.
 * DO NOT invent or modify official content here.
 *
 * To update content for future events, edit ONLY this file.
 */

// ─── Club Identity ────────────────────────────────────────────────────────────

export const clubInfo = {
  name: 'CyberHub',
  fullName: 'CyberHub Technology Club',
  tagline: 'Technology • Security • Innovation',
  description:
    'CyberHub is the official technology and cybersecurity club of SVCE. We connect ambitious students, competitive coders, and cybersecurity enthusiasts into a focused peer network — building the next generation of technical leaders through hands-on challenges, real-world problem solving, and structured competitions.',
  college: 'Sri Venkateswara College of Engineering (SVCE)',
  logoPath: '/assets/club-logo.jpeg',
};

// ─── Social & Contact ─────────────────────────────────────────────────────────

export const socialLinks = {
  instagram: 'https://www.instagram.com/cyberhub_svce?stkn=NDdoM3kxcXFjZWY3',
};

export const contactInfo = {
  contacts: [
    {
      role: 'Club President',
      phone: '+91 89253 23250',
      tel: 'tel:+918925323250',
    },
    {
      role: 'Club Vice Chairperson',
      phone: '+91 95005 41149',
      tel: 'tel:+919500541149',
    },
  ],
  instagram: socialLinks.instagram,
};

// ─── Event Flow ───────────────────────────────────────────────────────────────

export const eventFlow = [
  {
    step: '01',
    title: 'Registration',
    subtitle: 'Team Registration',
    description:
      'Register your team through the official CyberHub event platform. One registration per team. Login credentials are provided post-registration.',
    icon: 'register',
  },
  {
    step: '02',
    title: 'Cryptic Tide',
    subtitle: 'Test-Based Selection',
    description:
      'A timed, test-based round conducted through the event website. Tests cover Core CS, Web Security, Problem Solving, and Technical Thinking. Each question has a fixed time limit announced by the organizers.',
    icon: 'quiz',
  },
  {
    step: '03',
    title: 'Evaluation',
    subtitle: 'Results & Selection',
    description:
      'Participants who meet the selection criteria announced by the organizers will be shortlisted and directly selected for Round 2. No separate re-registration is required.',
    icon: 'evaluate',
  },
  {
    step: '04',
    title: 'Round 2',
    subtitle: 'Website Creation Challenge',
    description:
      "Selected teams access Round 2 via OTP verification using the team leader's registered email. After accepting Terms & Conditions, teams choose a timeline and build a website based on the reference provided by the organizers.",
    icon: 'build',
  },
];

// ─── Rules ────────────────────────────────────────────────────────────────────

export const rules = [
  {
    category: 'General Event Rules',
    accent: 'cyan',
    items: [
      'Participants must register/login using the details provided by the event organizers before entering the event platform.',
      'Participants must read and accept the event Terms & Conditions, Code of Conduct, and Privacy Notice before accessing the event rounds.',
      'Each participant must use only their own registered account. Sharing login credentials or allowing another person to participate using the account is not permitted.',
      'Participants must follow all instructions given by the CyberHub coordinators, volunteers, and event platform during the event.',
      'Any form of cheating, impersonation, unfair assistance, or attempt to bypass event restrictions may result in disqualification.',
      'The organizers reserve the right to verify submissions and participant activity when required for fair conduct of the event.',
    ],
  },
  {
    category: 'Cryptic Tide — Test-Based Selection Round',
    accent: 'indigo',
    items: [
      'Cryptic Tide is a test-based round conducted through the event website/platform.',
      'Single-tab rule: Participants must remain on the designated test tab throughout the test. Opening or switching to another browser tab is strictly prohibited.',
      'No external internet access: Participants must not use Google, search engines, other websites, online notes, AI tools, messaging platforms, or any other external internet resource during Cryptic Tide.',
      'No unauthorized internal access: Participants must not open or use developer tools, browser console, inspect/source code, hidden page content, APIs, or other internal technical features to obtain an unfair advantage.',
      'Participants must not use another device, including a mobile phone, tablet, second computer, or smartwatch, to obtain answers or assistance.',
      'Participants must not communicate with other participants during the test through chat, calls, messages, social media, or any other method.',
      'Question time limit: Each question must be answered within the number of seconds specified by the organizers. The exact time limit will be announced by the organizers.',
      'Copying, screen-sharing, taking unauthorized screenshots, recording the test, or using any method intended to obtain or share answers is prohibited.',
      'Selection for Round 2: Participants who meet the selection criteria announced by the organizers will be shortlisted and allowed to proceed to Round 2.',
      'If prohibited activity or suspicious behavior is detected, the participant may be disqualified from Cryptic Tide and/or the event.',
    ],
  },
  {
    category: 'Round 2 — Website Creation Challenge',
    accent: 'emerald',
    items: [
      'Round 2 is accessible only to participants/teams selected from Cryptic Tide.',
      "Access Process: No re-registration. Selected teams log in via the team leader's registered email, complete OTP verification, accept Terms & Conditions, select a timeline, then build and submit.",
      'The website must be created according to the selected timeline and the specific instructions provided by the organizers.',
      'A reference image/screenshot or webpage reference will be provided. Participants must use the given reference as the basis for their website design and implementation.',
      'Permitted Tools: Only tools/resources specifically allowed by the organizers may be used during Round 2.',
      'The final submission must include the required website project files in a ZIP file and the required screenshot(s) of the completed webpage.',
      'Submissions must be completed within the time limit announced by the organizers. Late submissions will be handled according to the announced submission policy.',
      "Participants must create the website themselves and must not submit another participant's completed project as their own.",
    ],
  },
  {
    category: 'Code of Conduct',
    accent: 'rose',
    items: [
      'Participants must behave respectfully toward organizers, volunteers, judges, and fellow participants.',
      'Abusive, threatening, discriminatory, disruptive, or inappropriate behavior is not permitted.',
      "Attempts to damage, disrupt, manipulate, or gain unauthorized access to the event website, test platform, or another participant's work are strictly prohibited.",
      'Participants must not intentionally exploit technical vulnerabilities or interfere with the normal operation of the event platform.',
      'The organizers may take appropriate action, including disqualification, when a participant violates the event rules.',
    ],
  },
];

// ─── Instructions ─────────────────────────────────────────────────────────────

export const instructions = [
  {
    phase: 'Before the Event',
    icon: 'before',
    steps: [
      'Complete team registration on the official CyberHub event platform using the details provided by the organizers.',
      'Read and accept the event Terms & Conditions, Code of Conduct, and Privacy Notice.',
      'Ensure each team member uses only their own registered account credentials.',
      'Join the official CyberHub WhatsApp group for real-time announcements and organizer communications.',
      'Prepare your device: stable internet connection, fully charged battery, and a single browser tab ready for the test.',
    ],
  },
  {
    phase: 'During Cryptic Tide',
    icon: 'during',
    steps: [
      'Log in with your registered credentials on the event platform.',
      'Remain on the designated test tab for the entire duration — do not switch tabs or open new windows.',
      'Do not use any external internet resources, AI tools, search engines, or messaging platforms.',
      'Do not open developer tools, browser console, or inspect source code.',
      'Do not use any secondary device (phone, tablet, smartwatch) during the test.',
      'Answer each question within the time limit specified for that question.',
      'Do not copy, screenshot, record, or share test content in any form.',
    ],
  },
  {
    phase: 'Round 2 Access (Selected Teams Only)',
    icon: 'round2',
    steps: [
      'No re-registration is required — selected teams are directly notified.',
      "The team leader must log in using their registered email address on the official Round 2 platform.",
      "Enter the OTP sent to the team leader's email to verify identity and gain access.",
      'Read and agree to the Round 2 Terms & Conditions, Code of Conduct, and Privacy Notice.',
      'Select your available timeline — once selected, the timeline is fixed and cannot be changed.',
      'Review the reference image/webpage provided by the organizers carefully before building.',
      'Use only the permitted tools announced by the organizers for Round 2.',
    ],
  },
  {
    phase: 'Submission',
    icon: 'submit',
    steps: [
      'Package your completed website project files into a properly organized ZIP file.',
      'Include the required screenshot(s) of the completed webpage as specified by the organizers.',
      'Submit before the announced deadline. Late submissions will be handled per the submission policy.',
      "Ensure the submitted project is entirely your own team's original work created during the round.",
    ],
  },
];
