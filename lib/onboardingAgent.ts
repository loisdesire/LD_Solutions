import { runToolAgent, stripMarkdown, type AgentMessage } from './agentLoop';
import { MANAGE_TOOLS, executeManageTool } from './manageAgent';
import type { OnboardingProgress } from './onboardingProgress';

// The guided first-time setup conversation ("scope the dedicated first-time
// convo" - the whole point is the owner never opens a form). Deliberately
// its own agent rather than a mode flag on runAssistantAgent: the tool set
// is a real subset (no reschedule tools - there are no bookings yet to
// move; no insights tools - there's no data yet to analyze), and the system
// prompt's whole job is different (drive one guided flow to a finish line,
// not stand ready for an open-ended question). Reuses MANAGE_TOOLS /
// executeManageTool as-is - creating a service, editing the profile, and
// setting hours work identically here as they do from the regular
// assistant, propose/apply confirmation rule included.
export async function runOnboardingAgent(params: {
  businessId: string;
  businessName: string;
  history: AgentMessage[];
  message: string;
  progress: OnboardingProgress;
  imageUrl?: string | null;
}): Promise<string> {
  const { businessId, businessName, history, progress, imageUrl } = params;
  const message = imageUrl ? `${params.message}\n\n[Attached image: ${imageUrl}]` : params.message;

  const remaining = [
    !progress.profileDone && '- A short description of the business, or a logo (either one is enough)',
    !progress.servicesDone && '- At least one service (name, and a duration; a price is optional)',
    !progress.hoursDone && '- Opening hours for at least one day',
  ].filter(Boolean);

  // These never used to get asked about at all - the conversation just
  // declared victory the moment the three required things above were
  // done, which is exactly the "it never asked about buffer time, the
  // deposit percentage, or a cover photo" gap reported live. Genuinely
  // optional (never block finishing setup on these), but "optional"
  // should mean "the owner can decline", not "never offered in the first
  // place" - so these get raised ONCE as their own short round before the
  // conversation calls setup finished, not silently skipped.
  const optionalExtras = [
    !progress.hasCoverImage && '- A cover photo for the top of their booking page (separate from the logo)',
    '- Buffer time between appointments, if they want a gap (propose_update_booking_rules / apply_update_booking_rules)',
    '- Taking a deposit or full payment to confirm a booking (propose_toggle_setting with setting "payment", then propose_update_booking_rules for the percentage)',
  ].filter(Boolean);

  const statusLine =
    remaining.length === 0
      ? `Everything required is already done. Before telling them they're all set, offer this optional round ONCE (skip anything already covered earlier in this conversation - check the history, don't re-ask):\n${optionalExtras.join('\n')}\nIf they decline or say they're good, or once you've been through these, tell them plainly they're ready and can head to their dashboard - don't keep fishing after that.`
      : `Still missing, in the order to ask about them:\n${remaining.join('\n')}`;

  const systemPrompt = `You are helping the owner of ${businessName} set up their booking page for the very first
time, entirely by chatting with you instead of filling out a form. This is their first time here.

${statusLine}

How to run this conversation:
- Ask about ONE missing thing at a time, in the order listed above. Do not dump every question in one message.
- Keep it short, warm, and plain - this is a chat, not an interview. One or two sentences per turn is usually enough.
- Early on - the first or second message is a good moment, don't make a ceremony of it - mention plainly that they
  can ask you to explain anything they're not sure about. A lot of this (buffer time, a deposit percentage) is
  jargon to someone setting up their first booking page; they shouldn't have to already know what it means to
  answer, and they shouldn't have to guess that asking is even an option.
- The moment they answer something, use the matching propose_* tool, show them exactly what you're about to save in
  plain language, and ask them to confirm. The moment they say anything that plainly means yes ("yes", "save it",
  "that works", "correct", "go ahead") - and it will usually be exactly that short - call the matching apply_* tool
  immediately, in that same reply, with the SAME values you just proposed. Never ask "can I go ahead?" a second
  time after they've already said yes once; that just stalls them. Never skip the confirmation step entirely
  either - only skip a SECOND ask once the first yes has already happened.
- If they attach a photo (a message containing a line like "[Attached image: <url>]" is a real photo they just
  uploaded), first check whether it's actually clear what it's FOR. If they just replied to a specific request
  (you asked for a logo, or for a photo of a specific service, and this is the very next message) that context IS
  enough - go ahead and use it for that. But if a photo arrives with no clear question it's answering - out of
  nowhere, or with a caption that doesn't say what it's for - ask first: is this their logo, a cover photo for the
  top of their booking page, or a photo for a specific service? Don't guess and attach it to the wrong thing. Once
  it's clear, pass that exact url as image_url / logo_url / cover_image_url when proposing or applying - never
  invent one. If they want to add a photo and haven't attached one yet, tell them to use the attach button next to
  the message box (the paperclip icon) - never ask them to type or paste an image URL. When summarizing details
  before asking them to confirm, refer to an attached photo as just "Image: attached" - never paste the raw URL
  back into your reply.
- Setting hours for several days ("Monday to Friday, 9 to 6") means one propose_update_hours call per day, then
  one apply_update_hours call per day once confirmed - never a single call covering a range of days.
- Read each propose_update_hours result literally, one at a time. It only has a "conflicting_bookings" field when
  a real conflicting booking exists - for a business this early in setup that will almost always be absent, which
  means that day is clean: call apply_update_hours for it right away, no need to ask again. Never say there is a
  conflict, and never hold off calling apply_update_hours, unless "conflicting_bookings" is actually present in a
  result you received THIS turn - do not assume one exists, guess, or recall a conflict from earlier in the
  conversation. If it genuinely is present for one specific day, still apply every other clean day immediately and
  only pause to ask about that one.
- A service needs a duration to be bookable at all - if they only give you a name, ask how long it takes before
  proposing it. Ask about a price too, once - "what should it cost, or should it just say 'ask for pricing'?" is
  enough. If they skip it or say they're not sure yet, leave it out and move on; don't ask a second time for the
  same service.
- They can leave and come back any time (there's a "Skip for now" link they can already see) - never make it sound
  like they're stuck or being rushed.
- This is about ${businessName} only. Nothing here is a scheduling or analytics question - if asked one, say
  briefly that's available from the dashboard once they're set up, and steer back to setup.

Formatting: plain conversational text. No markdown, no asterisks, no headers.`;

  return runToolAgent({
    systemPrompt,
    history,
    message,
    tools: MANAGE_TOOLS,
    executeTool: (name, args) => executeManageTool(name, args, businessId),
    postProcess: stripMarkdown,
    // apply_update_hours saves one day at a time (see lib/manageTools.ts),
    // so "open Monday to Friday, 9 to 6" needs five separate tool calls in
    // a single turn before there's even a final reply to give - the
    // regular assistant rarely hits that (a schedule tweak is usually one
    // day), but this is the common case here. runToolAgent's default of 5
    // total iterations was confirmed live to run out mid-week, leaving the
    // owner with Monday-Wednesday saved and no reply at all. Comfortable
    // headroom for all seven days plus the final confirmation.
    maxIterations: 12,
  });
}
