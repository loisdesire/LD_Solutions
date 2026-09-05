// Scripted, animated replay content for the homepage AI demo
// (components/LandingChatDemo.tsx). Deliberately NOT live - a real
// business, chosen at random, was found to accept typed input and never
// respond on the homepage; a scripted replay removes that failure mode
// entirely by never calling the real agent at all. `label` (keyed by the
// same `businessTypes` labels in lib/businessTypes.tsx, matching them
// together) fades in once its side's replay finishes, when one is
// given - not every side has one.
//
// No em dashes anywhere below - flagged directly as overused in this
// content (a real writing habit, not a one-off), rewritten to plain
// sentences with periods/commas/"and" instead.
export type ReplayTurn = { from: 'visitor' | 'ai'; text: string };
export type ReplaySide = { turns: ReplayTurn[]; label?: string };
export type LandingDemoScript = {
  label: string;
  businessName: string;
  customer: ReplaySide;
  owner: ReplaySide;
  /** The real business (see lib/site.ts's DEMO_SLUGS) this vertical maps to, if one's been seeded - lets the "try it for real" CTA after the replay link to an actual matching demo tenant instead of always defaulting to Glow Salon. Omitted verticals fall back to a plain signup CTA. */
  demoSlug?: string;
};

export const landingDemoScripts: LandingDemoScript[] = [
  {
    label: 'Salons & barbers',
    businessName: 'Glow Salon',
    demoSlug: 'glow-salon',
    customer: {
      turns: [
        { from: 'visitor', text: 'Hi, do you have anything free tomorrow afternoon for a haircut?' },
        { from: 'ai', text: "Let me check Glow Salon's calendar. 2:00pm or 3:30pm are both open tomorrow. Which works better for you?" },
        { from: 'visitor', text: '3:30 is perfect' },
        { from: 'ai', text: "You're booked for a Haircut tomorrow at 3:30pm with Glow Salon. You'll get a confirmation now and a reminder the day before. See you then! ✂️" },
      ],
      label: 'That took under 10 seconds. No forms, no back-and-forth, no waiting for someone to reply.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: 'cancel my 3pm today' },
        { from: 'ai', text: "That's Amaka's Haircut appointment at 3:00pm. Want me to cancel it and let her know?" },
        { from: 'visitor', text: 'yes cancel it and let her know' },
        { from: 'ai', text: "Cancelled, and Amaka's been notified. Your 3:00pm slot is open again." },
        { from: 'visitor', text: "how's today looking" },
        { from: 'ai', text: '6 bookings today, and one just opened up at 3pm. Thursday was busiest this week, with 9.' },
      ],
    },
  },
  {
    label: 'Wellness clinics',
    businessName: 'Calm Wellness Clinic',
    demoSlug: 'calm-wellness-clinic',
    customer: {
      turns: [
        { from: 'visitor', text: 'do you have a physio slot this week, mornings work best for me' },
        { from: 'ai', text: "Checking Calm Wellness's calendar. Wednesday at 9:30am or Friday at 10:00am are both free this week." },
        { from: 'visitor', text: 'Friday 10 please' },
        { from: 'ai', text: "You're booked for a Physiotherapy session on Friday at 10:00am. You'll get a reminder the day before, and please arrive 10 minutes early for intake." },
      ],
      label: 'Same conversation, whether it’s a haircut or a health appointment.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: 'move my 11am to 2pm tomorrow instead' },
        { from: 'ai', text: "That's Chidi's Physiotherapy session, currently 11am tomorrow. 2pm tomorrow is open. Want me to move it and notify Chidi?" },
        { from: 'visitor', text: 'yes' },
        { from: 'ai', text: "Moved to 2pm, and Chidi's been notified." },
        { from: 'visitor', text: 'any no-shows this week?' },
        { from: 'ai', text: "One no-show, Tuesday's 4pm. Everyone else checked in." },
      ],
    },
  },
  {
    label: 'Tutors & coaches',
    businessName: 'Bright Minds Tutoring',
    demoSlug: 'bright-minds-tutoring',
    customer: {
      turns: [
        { from: 'visitor', text: 'hi, does the maths tutor have any slots this weekend?' },
        { from: 'ai', text: "Checking Bright Minds's calendar. Saturday 11am or Sunday 3pm are both open." },
        { from: 'visitor', text: 'Saturday works' },
        { from: 'ai', text: "You're booked for a Maths session on Saturday at 11am. A reminder will go out the evening before." },
      ],
      label: 'Parents book you the same way they’d book anything else, no phone tag.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: "what's on tomorrow" },
        { from: 'ai', text: '4 sessions tomorrow: 10am, 12pm, 3pm, and 5pm. The 3pm is a new student, first session.' },
        { from: 'visitor', text: 'cancel the 5pm, something came up' },
        { from: 'ai', text: 'Cancelled the 5pm and let the family know. Want me to suggest a reschedule time?' },
      ],
    },
  },
  {
    label: 'Consultants',
    businessName: 'Adaeze Consulting',
    customer: {
      turns: [
        { from: 'visitor', text: "I'd like to book a strategy call, what's available next week?" },
        { from: 'ai', text: 'Checking Adaeze Consulting’s calendar. Tuesday 10am or Thursday 2pm are open next week.' },
        { from: 'visitor', text: 'Thursday 2pm' },
        { from: 'ai', text: "You're booked for a 45-minute strategy call on Thursday at 2pm. You'll get a calendar invite and a reminder the morning of." },
      ],
      label: 'Clients book a real slot on your real calendar, not a guess that needs confirming later.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: 'how many calls do I have this week' },
        { from: 'ai', text: "7 calls this week: 2 today, 3 tomorrow, 2 on Thursday. Thursday's your busiest day." },
        { from: 'visitor', text: 'block off Friday afternoon, I need focus time' },
        { from: 'ai', text: 'Friday afternoon is now marked unavailable, so no one can book into it.' },
      ],
    },
  },
  {
    label: 'Photographers',
    businessName: 'Lens & Light Studio',
    customer: {
      turns: [
        { from: 'visitor', text: 'do you have a slot for a portrait shoot next Saturday?' },
        { from: 'ai', text: 'Checking Lens & Light’s calendar. Next Saturday has 10am or 1pm open for a portrait session.' },
        { from: 'visitor', text: '1pm please' },
        { from: 'ai', text: 'You’re booked for a Portrait shoot next Saturday at 1pm. A ₦10,000 deposit link will follow to secure the slot.' },
      ],
      label: 'Even the deposit gets handled in the same conversation.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: 'did the Saturday shoot deposit come in' },
        { from: 'ai', text: 'Yes, the ₦10,000 deposit came in this morning and the slot is confirmed.' },
        { from: 'visitor', text: 'good, add a note to bring the second lens for that one' },
        { from: 'ai', text: 'Noted on Saturday’s 1pm booking: "bring second lens."' },
      ],
    },
  },
  {
    label: 'Personal trainers',
    businessName: 'FitCore Personal Training',
    customer: {
      turns: [
        { from: 'visitor', text: 'can I get a session in tomorrow evening?' },
        { from: 'ai', text: "Checking FitCore's calendar. 6pm or 7:30pm are both open tomorrow evening." },
        { from: 'visitor', text: '6pm' },
        { from: 'ai', text: "You're booked for a 1-hour session tomorrow at 6pm. See you then!" },
      ],
      label: 'Fully booked calendars stay accurate, automatically.',
    },
    owner: {
      turns: [
        { from: 'visitor', text: "who's booked with me this week" },
        { from: 'ai', text: '9 sessions this week across 5 clients. Tolu has 3, everyone else has 1-2.' },
        { from: 'visitor', text: 'add a recurring Monday 7am slot for Tolu going forward' },
        { from: 'ai', text: 'Tolu now has a standing Monday 7am booking, starting next week.' },
      ],
    },
  },
];
