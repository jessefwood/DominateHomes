import type { Course } from '@/lib/course-content'

/**
 * Dominating Your Business, the agent course.
 *
 * Source: "Dominating Your Business: Full Course Export", version 1, October
 * 25, 2026, in the Dominate Business Series: Four Legs folder on Drive. When
 * this file and that document disagree, the document wins until Davina
 * changes it. Wording is hers and is copied, not paraphrased.
 *
 * KEYS ARE PERMANENT. Every module, lesson and worksheet question has a key,
 * and an agent's answers are stored against it. Change a label as much as you
 * like; change a key once anybody has answered and their answer disappears
 * from the page (it is still in the database, under the old key).
 *
 * Modules 2 to 7 carry the lesson outline from the export. Each lesson there
 * is one line until Davina's full text is written; `draftNote` says so on the
 * design side only.
 */
export const dominatingYourBusiness: Course = {
  slug: 'dominating-your-business',
  title: 'Dominating Your Business',
  tagline: 'Build your table, leg by leg.',
  audience: 'Dominate Homes agents',
  modules: [
    // -----------------------------------------------------------------------
    {
      key: 'build-your-table',
      number: 1,
      title: 'Build your table',
      date: '2026-10-26',
      goal: 'Know why you are building this and what you stand for before you do anything else.',
      opening: {
        key: 'opening',
        title: 'Opening',
        blocks: [
          {
            kind: 'text',
            text: "Let me tell you when this got real for me. I was in real estate, but I hadn't really jumped in yet. Then I went through my divorce, and all of a sudden it was just me. Either I was going to do it, or it wasn't going to get done. That's the moment I decided to take my business seriously and go for it.",
          },
          {
            kind: 'text',
            text: "Nobody else is going to pay you. Your business is what feeds you and your family. It's what brings generational bread to your house. What you're building is a table your family can eat at for generations.",
          },
          {
            kind: 'text',
            text: "And I can tell when somebody is treating this like a hobby. They don't have a schedule. They're not consistent. They don't know their numbers. They don't know what it takes to have business coming in month after month. They're receivers of business, waiting around to see what happens. A business owner is a planner. A business owner says, this is what we're going to go do, and then goes and makes it happen.",
          },
          {
            kind: 'text',
            text: "That's what this course is. We're going to build your table leg by leg: your numbers, your marketing, your sales, your operations, your finances, and a plan you actually run every day.",
          },
          {
            kind: 'text',
            text: 'My table looks different now than it did back then. My goal today is to help other people build their table, bring as many people along as I can, and create leaders who can turn around and do the same thing for somebody else. That\'s you.',
          },
          {
            kind: 'callout',
            label: 'Your mirror moment',
            text: "You are your biggest obstacle. Look at yourself and tell yourself to get out of your own way. There is no reason you cannot be successful in this business, because you're called to do it.",
          },
        ],
      },
      lessons: [
        {
          key: 'your-why',
          title: 'Your why',
          blocks: [
            {
              kind: 'text',
              text: "Your why is what gets you on the phone on the days you don't feel like it. Answer these four honestly before you do anything else this week.",
            },
            {
              kind: 'list',
              items: [
                'What do you truly want from your real estate career?',
                'What would getting that give you?',
                "How would you know you've achieved it?",
                'What would success look and feel like?',
              ],
            },
          ],
        },
        {
          key: 'your-value-prop',
          title: 'Your value prop',
          blocks: [
            {
              kind: 'text',
              text: 'Your value prop is the one sentence people use when they refer you. Write the long version first, then shorten it to under ten words for your bio and signs.',
            },
            {
              kind: 'callout',
              label: 'Formula',
              text: 'I help [who] achieve [outcome] in [where], because [proof].',
            },
            {
              kind: 'text',
              text: "Your proof has to be a number, a credential, a named system, or lived experience. If you're new, borrow the team's number, say so honestly, and set the date you'll replace it with your own.",
            },
            {
              kind: 'steps',
              items: [
                'Could any agent in your zip code say this word for word?',
                'Is there a number, credential, named system or lived experience in it?',
                'Can you back it up if a client asks?',
                'Would a past client repeat it correctly to a coworker?',
                'Does it say what changes for them, or only what you do?',
              ],
            },
            {
              kind: 'text',
              text: "Then say it out loud to someone who isn't an agent. If they ask a clarifying question, the sentence is doing too much work.",
            },
          ],
          notes: 'The five questions are the five-question test.',
        },
        {
          key: 'three-brand-layers',
          title: 'Your three brand layers',
          blocks: [
            {
              kind: 'terms',
              items: [
                {
                  term: 'Your name',
                  meaning:
                    'The only layer that travels with you. Own your domain, your database in Follow Up Boss, your reviews and your social handles.',
                },
                {
                  term: 'Dominate Homes',
                  meaning: "The team. Systems, leads, TC, training, signs. Yours to use while you're here.",
                },
                {
                  term: 'Iron Valley',
                  meaning:
                    'Your license, legal standing and compliance. Required on marketing. Check brokerage policy before you print.',
                },
              ],
            },
            {
              kind: 'callout',
              label: 'Order on everything you make',
              text: 'Your name first, Dominate Homes second, Iron Valley where policy requires.',
            },
          ],
        },
        {
          key: 'goals-standards-habits',
          title: 'Goals, standards and habits',
          blocks: [
            {
              kind: 'terms',
              items: [
                { term: 'Goal', meaning: "What you're going for. Set by you. The market gets a vote." },
                { term: 'Standard', meaning: 'What we all do, no matter what. Set by the team. Same for everyone.' },
                { term: 'Habit', meaning: 'How you make sure you do it. Built by you, on your calendar.' },
              ],
            },
            { kind: 'text', text: 'Dominate Homes team standards:' },
            {
              kind: 'list',
              items: [
                'Speed to lead under 5 minutes on 90% or more of leads',
                '10 to 12 contact attempts on a new lead in the first 7 days',
                'Database to 100 people as fast as possible, then 25 new people a month',
                'Weekly scorecard turned in by Monday, reviewed at the Monday team meeting',
                'Attend Monday team training',
              ],
            },
            {
              kind: 'text',
              text: 'Miss a goal while keeping the standards and we adjust the plan. Miss a standard and we have a coaching conversation.',
            },
            {
              kind: 'callout',
              text: "Your goal is what you hope for. Your standard is what you're held to. Your habits decide which one you hit.",
            },
          ],
        },
      ],
      worksheet: {
        title: 'Week 1 worksheet',
        due: '2026-11-02',
        fields: [
          { kind: 'long', key: 'want', label: 'What do you truly want from your real estate career?' },
          { kind: 'long', key: 'would-give', label: 'What would getting that give you?' },
          { kind: 'long', key: 'know-achieved', label: "How will you know you've achieved it?" },
          { kind: 'long', key: 'look-and-feel', label: 'What will success look and feel like?' },
          { kind: 'text', key: 'why', label: 'Your why, in one sentence' },
          {
            kind: 'sentence',
            key: 'value-prop',
            label: 'Your value prop',
            template: 'I help {who} achieve {outcome} in {where}, because {proof}.',
            parts: [
              { key: 'who', label: 'Who' },
              { key: 'outcome', label: 'Outcome' },
              { key: 'where', label: 'Where' },
              { key: 'proof', label: 'Proof' },
            ],
            help: 'Proof has to be a number, a credential, a named system or lived experience.',
          },
          { kind: 'text', key: 'value-prop-short', label: 'Short version, under ten words' },
          {
            kind: 'checks',
            key: 'five-question-test',
            label: 'Five-question test',
            options: [
              'Not something any agent in my zip code could say',
              'Has a number, credential, named system or lived experience',
              'I can back it up if a client asks',
              'A past client could repeat it from memory',
              'Says what changes for them',
              "I said it out loud to someone who isn't an agent",
            ],
          },
          {
            kind: 'number',
            key: 'database-count',
            label: 'How many people are in your database in Follow Up Boss right now?',
          },
          {
            kind: 'checks',
            key: 'standards-sign-off',
            label: 'Team standards sign-off',
            help: 'Check each one you are signing up to.',
            options: [
              'Speed to lead under 5 minutes',
              '10 to 12 attempts in the first 7 days',
              'Database to 100, then 25 a month',
              'Scorecard in by Monday',
              'Attend Monday training',
            ],
          },
          {
            kind: 'long',
            key: 'three-habits',
            label: "Three habits you'll put on your calendar this week to hit those standards",
          },
          { kind: 'signature', key: 'signature', label: 'Type your name to sign' },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'know-your-numbers',
      number: 2,
      title: 'Know your numbers',
      date: '2026-11-02',
      goal: 'Turn the life you want into a daily number.',
      draftNote: 'Lesson text still to be written in your voice. Each lesson below is the one-line outline from the export. The math is built in the workbooks.',
      lessons: [
        { key: 'surviving', title: 'Surviving', blocks: [{ kind: 'text', text: 'What your year costs, personal and business.' }] },
        { key: 'thriving', title: 'Thriving', blocks: [{ kind: 'text', text: 'The extra that makes the year worth having.' }] },
        {
          key: 'your-split',
          title: 'Your split and what you actually keep',
          blocks: [
            {
              kind: 'text',
              text: 'Your split level, the $14,900 cap that resets every May, the $200 team fee on every closing, and the $495 brokerage fee.',
            },
            {
              kind: 'terms',
              items: [
                { term: 'Mentee', meaning: '70/30' },
                { term: 'Experienced', meaning: '80/20' },
                { term: 'Sales Manager or Team Lead', meaning: '90/10' },
              ],
            },
            {
              kind: 'callout',
              label: 'Take-home per closing',
              text: 'Agent share, minus the $200 team fee, minus the $495 brokerage fee.',
            },
          ],
        },
        { key: 'deals-needed', title: 'Deals needed', blocks: [{ kind: 'text', text: 'At your own average commission.' }] },
        {
          key: 'seventy-thirty',
          title: '70/30',
          blocks: [
            {
              kind: 'text',
              text: '70% of your business from your sphere, 30% from leads. This is a margin decision: a lead closing gives away about a third of its commission before anyone gets paid.',
            },
          ],
        },
        {
          key: 'the-funnel',
          title: 'The funnel',
          blocks: [
            { kind: 'text', text: 'Deals back to agreements, appointments, conversations, then per week and per day.' },
            {
              kind: 'steps',
              items: [
                'Pendings needed = closings ÷ 0.80',
                'Agreements = pendings ÷ 0.60',
                'Appointments met = agreements ÷ 0.60',
                'Appointments set = appointments met ÷ 0.60',
                'Conversations = appointments set ÷ 0.60',
                'Weekly conversations = conversations ÷ 46',
              ],
            },
          ],
          notes: 'Team baseline: 60% conversion at each stage, 20% fallout, 46 working weeks.',
        },
        {
          key: 'database-math',
          title: 'Database math',
          blocks: [{ kind: 'callout', text: '100 people worked gives about 6 to 7 closings a year.' }],
        },
      ],
      worksheet: {
        title: 'Week 2 worksheet',
        due: '2026-11-09',
        fields: [
          { kind: 'number', key: 'personal-costs', label: 'Surviving: total yearly personal costs' },
          { kind: 'number', key: 'business-costs', label: 'Surviving: total yearly business costs' },
          { kind: 'long', key: 'thriving', label: 'Thriving: what you want on top, and what it costs' },
          {
            kind: 'choice',
            key: 'split-level',
            label: 'Your split level',
            options: ['Mentee 70/30', 'Experienced 80/20', 'Sales Manager or Team Lead 90/10'],
          },
          { kind: 'number', key: 'average-price', label: 'Your average sale price' },
          { kind: 'number', key: 'average-commission', label: 'Your average commission rate' },
          {
            kind: 'number',
            key: 'take-home',
            label: 'Your take-home per closing',
            help: 'From your profitability workbook.',
          },
          { kind: 'number', key: 'closings-needed', label: 'Closings needed this year' },
          {
            kind: 'text',
            key: 'sphere-and-lead-closings',
            label: 'Of those, sphere closings (70%) and lead closings (30%)',
          },
          {
            kind: 'number',
            key: 'weekly-conversations',
            label: 'Weekly conversations needed',
            help: 'From the funnel.',
          },
          {
            kind: 'text',
            key: 'database-needed',
            label: 'Database people needed for your sphere closings, and how many you have to add',
          },
          { kind: 'choice', key: 'workbook-done', label: 'Profitability workbook filled in', options: ['Yes', 'No'] },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'marketing',
      number: 3,
      title: 'Marketing',
      date: '2026-11-09',
      goal: 'Get hands raised. Marketing is done when a hand goes up.',
      draftNote: 'Content exists across many docs; one rewrite into the new pillar order is still to do. Activity menus for Paid, Content and Cold are still to finish.',
      lessons: [
        {
          key: 'read-database',
          title: 'READ, your database',
          blocks: [
            {
              kind: 'text',
              text: 'Everyone goes in Follow Up Boss, tagged by source and ranked. Get to 100 fast, then add 25 a month. Nobody gets deleted; D-ranked contacts go to long-term nurture.',
            },
          ],
        },
        {
          key: 'pillar-soi',
          title: 'Pillar 1, SOI (required)',
          blocks: [
            {
              kind: 'text',
              text: 'People who already know, like and trust you, plus your personal social. Calls, texts, handwritten notes and pop-bys are required of every agent.',
            },
          ],
        },
        { key: 'pillar-paid', title: 'Pillar 2, Paid and partner', blocks: [{ kind: 'text', text: 'Lead sources you pay for or partner with.' }] },
        { key: 'pillar-content', title: 'Pillar 3, Content', blocks: [{ kind: 'text', text: 'Social media and content-style marketing.' }] },
        {
          key: 'pillar-cold',
          title: 'Pillar 4, Cold',
          blocks: [
            {
              kind: 'text',
              text: 'People you meet cold. Open houses, circle prospecting, FSBOs, expireds, farming, door knocking.',
            },
          ],
        },
        {
          key: 'picking-pillars',
          title: 'Picking your pillars',
          blocks: [{ kind: 'text', text: 'Start with SOI plus one, add the next once the first two are consistent.' }],
        },
        {
          key: 'listings-as-marketing',
          title: 'Listings as marketing',
          blocks: [{ kind: 'text', text: 'Getting in front of your people with every listing.' }],
        },
      ],
      worksheet: {
        title: 'Week 3 worksheet',
        due: '2026-11-16',
        fields: [
          { kind: 'text', key: 'database-and-date', label: 'Database count today, and your date to reach 100' },
          { kind: 'number', key: 'soi-calls', label: 'Pillar 1 SOI: personal calls per week' },
          { kind: 'number', key: 'soi-texts', label: 'Pillar 1 SOI: personal texts per week' },
          { kind: 'number', key: 'soi-notes', label: 'Pillar 1 SOI: handwritten notes per week' },
          { kind: 'choice', key: 'soi-pop-bys', label: 'Pillar 1 SOI: pop-bys', options: ['Monthly', 'Quarterly'] },
          {
            kind: 'choice',
            key: 'soi-events',
            label: 'Pillar 1 SOI: client events',
            options: ['Quarterly', 'Twice a year'],
          },
          {
            kind: 'choice',
            key: 'soi-newsletter',
            label: 'Pillar 1 SOI: newsletter or market report',
            options: ['Weekly', 'Monthly'],
          },
          {
            kind: 'choice',
            key: 'soi-annual-touches',
            label: 'Pillar 1 SOI: annual CMA, birthday and home anniversary touches set up',
            options: ['Yes', 'No'],
          },
          { kind: 'text', key: 'soi-social', label: 'Pillar 1 SOI: social posts per week, stories per week' },
          { kind: 'number', key: 'soi-engaging', label: "Pillar 1 SOI: minutes a week engaging on other people's posts" },
          { kind: 'long', key: 'second-pillar', label: 'Your second pillar, and why you picked it' },
          { kind: 'long', key: 'second-pillar-activities', label: "Your second pillar's weekly activities and numbers" },
          {
            kind: 'long',
            key: 'pillar-scoring',
            label: 'Pillar scoring',
            help: "Score each pillar you're considering 1 to 5 on time cost, money cost, confidence, and likely hand raises in 30 days.",
          },
          {
            kind: 'long',
            key: 'signature-offers',
            label: "Three signature offers, each with a DM keyword and how you'll deliver it",
          },
          { kind: 'long', key: 'next-listing', label: "How you'll market your next listing to your own people" },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'sales',
      number: 4,
      title: 'Sales',
      date: '2026-11-16',
      goal: 'Turn a raised hand into a contract. Sales is done when a contract is written. A listing agreement is not the finish line.',
      draftNote: 'Strongest leg. Buyer consultation presentation and offer-writing lesson still to write. Buyer script and buyer process to merge into one lesson.',
      lessons: [
        {
          key: 'lead-to-appointment',
          title: 'Stage 1, lead to appointment',
          blocks: [
            {
              kind: 'text',
              text: 'Speed to lead in 1 to 5 minutes. The 3x3 for days 1 to 3, then the 10 Days of Pain through day 10. Not reached after day 10 goes to Attempting to Contact, not Nurture. Nurture is only for people you have actually talked to.',
            },
          ],
        },
        {
          key: 'fub-setup',
          title: 'Follow Up Boss setup',
          blocks: [
            {
              kind: 'text',
              text: 'Check action plans before applying one, tag first and then set the stage, every deal starts in Start.',
            },
          ],
        },
        {
          key: 'lead-source-one-sheets',
          title: 'Lead source one-sheets',
          blocks: [{ kind: 'text', text: 'How each source arrives and its split.' }],
        },
        {
          key: 'appointment-to-agreement',
          title: 'Stage 2, appointment to agreement',
          blocks: [{ kind: 'text', text: 'Buyer consultation, listing presentation, CMA and pricing to the evidence.' }],
        },
        {
          key: 'buyer-flow',
          title: 'Buyer flow',
          blocks: [
            {
              kind: 'text',
              text: 'Buyer agreement signed before the first showing, every time. Saved search. At least one conversation a week with active buyers.',
            },
          ],
        },
        {
          key: 'seller-flow',
          title: 'Seller flow',
          blocks: [
            {
              kind: 'text',
              text: 'Initial CMA before you see the house, listing appointment, go live, seller update every Tuesday.',
            },
          ],
        },
        {
          key: 'agreement-to-contract',
          title: 'Stage 3, agreement to contract',
          blocks: [{ kind: 'text', text: 'Writing and negotiating offers, staying in front.' }],
        },
        { key: 'the-pond', title: 'Working the pond', blocks: [{ kind: 'text', text: 'Working the pond.' }] },
        {
          key: 'scripts',
          title: 'Scripts and objection handling',
          blocks: [{ kind: 'text', text: 'Taught inside every stage.' }],
        },
      ],
      worksheet: {
        title: 'Week 4 worksheet',
        due: '2026-11-23',
        fields: [
          { kind: 'text', key: 'speed-to-lead', label: 'Your average speed to lead last week' },
          {
            kind: 'checks',
            key: 'one-sheets-read',
            label: 'Lead source one-sheets read',
            options: ['Clever Buyer', 'Clever Cash Offer', 'Redfin', 'Homes.com', 'ReferralExchange', 'HomeLight'],
          },
          {
            kind: 'checks',
            key: 'fub-cleanup',
            label: 'Follow Up Boss cleanup done',
            options: [
              'Every lead tagged buyer, seller or buyer/seller',
              'Stages correct',
              'No stacked action plans',
              'Every deal started in Start',
            ],
          },
          { kind: 'long', key: 'active-buyers', label: 'Active buyers: how many, and when you last talked to each' },
          { kind: 'long', key: 'tuesday-update', label: 'Your listings: is the Tuesday update going out' },
          {
            kind: 'long',
            key: 'pond-block',
            label: 'One pond block on your calendar this week, and how many update calls you made',
          },
          { kind: 'long', key: 'objection', label: "The objection you'll role-play every day this week" },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'operations',
      number: 5,
      title: 'Operations',
      date: '2026-11-23',
      goal: 'Get from contract to closed. Operations is done when it closes.',
      draftNote: 'Flow is done. Buyer under-contract flow and seller email sequence still to write.',
      lessons: [
        {
          key: 'eighteen-steps',
          title: 'The 18 steps',
          blocks: [
            { kind: 'text', text: 'From contract executed to seller funded.' },
            {
              kind: 'steps',
              items: [
                'Contract executed: calendar every deadline, start the buyer or seller flow',
                'Earnest money confirmed with title',
                'Lender milestones: loan application deadline, financing contingency date',
                'Home inspection, negotiated to an executed PICRA',
                'Other inspections in contract timeframes: pool, septic, radon, lead-based paint, termite and moisture',
                'HOA or condo documents and the review period',
                'Appraisal: supported or challenged; lender-required repairs by loan type',
                'Title, survey, elevation certificate if needed, homeowners insurance',
                'Repairs completed, receipts before the walkthrough',
                'Home warranty, if agreed',
                'Clear to close, or straight to closing if cash',
                'Closing disclosure review',
                'Commission paperwork to title',
                'SkySlope file complete and broker reviewed',
                'Utilities: buyer sets up, seller transfers out',
                'Final walkthrough',
                'Closing: title transfers, seller funded, keys, remotes and codes handed over',
                'After closing: ask for a review, tag as past client in Follow Up Boss',
              ],
            },
          ],
        },
        {
          key: 'three-setups',
          title: 'Three setups',
          blocks: [
            {
              kind: 'terms',
              items: [
                { term: 'Solo', meaning: 'The agent does every step.' },
                {
                  term: 'TC only',
                  meaning: 'TC runs the contract, paperwork and scheduling; agent keeps calendar and client updates.',
                },
                {
                  term: 'TC plus assistant',
                  meaning:
                    "TC runs paperwork and scheduling; assistant keeps the agent's calendar, updates the client on access, gets repair estimates, schedules repairs and arranges access.",
                },
              ],
            },
          ],
        },
        {
          key: 'agent-negotiates',
          title: 'The agent keeps every negotiation',
          blocks: [{ kind: 'callout', text: 'Staff never negotiate.' }],
        },
        {
          key: 'client-communication',
          title: 'Client communication',
          blocks: [{ kind: 'text', text: 'Client communication while under contract.' }],
        },
        {
          key: 'after-closing',
          title: 'After closing',
          blocks: [{ kind: 'text', text: 'Review request, past client tag, back into READ.' }],
        },
      ],
      worksheet: {
        title: 'Week 5 worksheet, Operations',
        due: '2026-11-30',
        fields: [
          { kind: 'choice', key: 'setup', label: 'Which setup you run', options: ['Solo', 'TC only', 'TC plus assistant'] },
          { kind: 'long', key: 'who-does-each-step', label: 'For each of the 18 steps, who does it on your deals' },
          {
            kind: 'long',
            key: 'deals-and-deadlines',
            label: 'Your current deals under contract and every deadline on your calendar',
          },
          {
            kind: 'checks',
            key: 'after-closing',
            label: 'Your after-closing steps',
            options: ['Review asked', 'Past client tag added'],
          },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'knowing-your-finances',
      number: 6,
      title: 'Knowing your finances',
      date: '2026-11-23',
      goal: 'Finance is done once every dollar has been assigned a job.',
      draftNote: 'Thinnest module. Lesson text to write from scratch.',
      lessons: [
        { key: 'get-paid', title: 'Get paid', blocks: [{ kind: 'text', text: 'How commission moves and what reaches you.' }] },
        { key: 'every-dollar', title: 'Give every dollar a job', blocks: [{ kind: 'text', text: 'Taxes set aside first.' }] },
        {
          key: 'budget-each-leg',
          title: 'Budget each leg',
          blocks: [{ kind: 'text', text: 'What you can afford to spend on marketing, tools and brand.' }],
        },
        { key: 'reinvest', title: 'Reinvest', blocks: [{ kind: 'text', text: 'Put money back into the business that produced it.' }] },
        {
          key: 'pay-yourself',
          title: 'Pay yourself and build wealth',
          blocks: [{ kind: 'text', text: 'Retirement and investing.' }],
        },
        { key: 'protect', title: 'Protect', blocks: [{ kind: 'text', text: 'Insurance, E and O, compliance.' }] },
        { key: 'monthly-review', title: 'Monthly money review', blocks: [{ kind: 'text', text: 'Monthly money review.' }] },
      ],
      worksheet: {
        title: 'Week 5 worksheet, Finances',
        due: '2026-11-30',
        fields: [
          { kind: 'number', key: 'tax-percentage', label: 'Percentage you set aside for taxes' },
          {
            kind: 'long',
            key: 'budget-by-leg',
            label: 'Monthly budget for each leg: marketing, sales, operations, finance',
          },
          { kind: 'long', key: 'brand-spend', label: 'Your brand spend: domain, headshot, design tools, signs' },
          { kind: 'text', key: 'reinvest', label: "What you'll reinvest from your next closing" },
          { kind: 'text', key: 'retirement', label: "Retirement or investing: what you'll put away each closing" },
          { kind: 'text', key: 'review-day', label: "The day each month you'll do your money review" },
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      key: 'run-the-plan',
      number: 7,
      title: 'Run the plan',
      date: '2026-11-30',
      goal: 'Turn everything you built into what you do every day.',
      draftNote: 'Plan is built. One tracker standard, One Page Plan and calendar (digital and printable) still to build.',
      lessons: [
        {
          key: 'business-plan',
          title: 'Your business plan',
          blocks: [{ kind: 'text', text: 'Your business plan, filled in module by module.' }],
        },
        { key: 'one-page-plan', title: 'The One Page Plan', blocks: [{ kind: 'text', text: 'What to do every day.' }] },
        {
          key: 'perfect-week',
          title: 'Your perfect week',
          blocks: [{ kind: 'text', text: 'Your perfect week and one-page calendar.' }],
        },
        {
          key: 'tracker-and-scorecard',
          title: 'The daily tracker and the Monday scorecard',
          blocks: [{ kind: 'text', text: 'Green, yellow, red on standards.' }],
        },
        {
          key: 'reviews-and-re-up',
          title: 'Reviews and the re-up',
          blocks: [
            {
              kind: 'text',
              text: 'Monthly review, quarterly goal check, Last Half Best Half re-up in July, January rebuild.',
            },
          ],
        },
        {
          key: 'blitz-prep',
          title: 'Getting ready for the December blitz',
          blocks: [
            {
              kind: 'list',
              items: [
                '90 days, starting in December.',
                '5 days off allowed during December for the holidays.',
                '$100 buy-in for anyone who wants in. Davina matches every buy-in. Winner takes the pot.',
              ],
            },
          ],
          notes: 'Parked until the blitz is built: disqualification rules, and whether more than one person can win. Igor to review the buy-in and payout setup before it goes to the team.',
        },
      ],
      worksheet: {
        title: 'Week 6 worksheet',
        due: '2026-12-07',
        fields: [
          {
            kind: 'long',
            key: 'one-page-plan',
            label: 'One Page Plan: income goal, closings, your pillars, your daily activities',
          },
          {
            kind: 'checks',
            key: 'perfect-week',
            label: 'Perfect week blocked on your calendar',
            options: ['Power hours', 'SOI time', 'Content time', 'Appointments', 'Family time'],
          },
          { kind: 'choice', key: 'tracker', label: 'Daily tracker set up', options: ['Yes', 'No'] },
          { kind: 'choice', key: 'first-scorecard', label: 'First scorecard turned in', options: ['Yes', 'No'] },
          {
            kind: 'choice',
            key: 'blitz',
            label: 'Blitz: in or out, and buy-in paid',
            options: ['In, buy-in paid', 'In, buy-in not paid yet', 'Out'],
          },
        ],
      },
    },
  ],
}
