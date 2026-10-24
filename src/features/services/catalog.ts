/**
 * Service content SEED, written to the `services` collection by
 * `npm run db:init`; the database is the source of truth afterwards.
 * Copy is general patient information drafted for the clinic's review — it
 * makes no claims about results and gives no individual advice. Only
 * services the clinic has confirmed are `published` (docs/PHASE_00_DISCOVERY.md
 * §3 item 4); the admin manages publication.
 */

export type ServiceSection = { heading: string; paragraphs: string[] };
export type ServiceFaq = { q: string; a: string };

export type ServiceContent = {
  slug: string;
  title: string;
  summary: string;
  sections: ServiceSection[];
  faqs: ServiceFaq[];
  published: boolean;
  bookable: boolean;
  order: number;
  seo?: { title?: string; description?: string };
};

export const SERVICE_CATALOG: ServiceContent[] = [
  {
    slug: "dental-consultation",
    title: "Dental Consultation",
    summary:
      "A check of your teeth and gums with Dr. Ratan Raghav, a clear explanation of what was found, and a discussion of your options.",
    sections: [
      {
        heading: "What a consultation is",
        paragraphs: [
          "A consultation is the starting point for most dental care. The dentist listens to your concerns, examines your teeth, gums and mouth, and explains what they see in plain language.",
          "If anything needs attention, you will be told what the options are, what each involves, and what to expect next, so you can decide with full information.",
        ],
      },
      {
        heading: "What to expect at your visit",
        paragraphs: [
          "Please arrive a few minutes early and bring a list of any medicines you take and any previous dental reports or X-rays you have.",
          "The examination itself is usually painless. If the dentist needs more information, for example an X-ray, this will be explained and discussed with you first.",
        ],
      },
      {
        heading: "When to book a consultation",
        paragraphs: [
          "Book a consultation if you have toothache, sensitivity, bleeding or swollen gums, a broken or loose tooth, a bad taste or bad breath that does not go away, or if it has been a long time since your last check-up.",
          "If you have severe swelling, difficulty swallowing or breathing, or heavy bleeding, seek urgent medical care immediately.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need to prepare anything?",
        a: "Bring a list of your current medicines and any old dental records or X-rays. Tell the dentist about any medical conditions, allergies or pregnancy.",
      },
      {
        q: "Will I receive treatment on the same day?",
        a: "That depends on what the examination shows and how much time the treatment needs. The dentist will discuss the plan and timing with you.",
      },
    ],
    published: true,
    bookable: true,
    order: 1,
  },
  {
    slug: "general-dentistry",
    title: "General Dentistry",
    summary: "Everyday dental care to keep teeth and gums healthy, from check-ups to treating common problems.",
    sections: [
      {
        heading: "What general dentistry covers",
        paragraphs: [
          "General dentistry is the routine care most people need throughout life: examinations, cleaning, treating tooth decay and gum problems, and advice on looking after your teeth at home.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "Your dentist will examine your mouth, explain any findings and suggest a plan. Simple treatments may be done at the same visit; others may need a separate appointment.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Regular check-ups help find problems early. Book sooner if you notice pain, sensitivity, bleeding gums or any change in your mouth that worries you.",
        ],
      },
    ],
    faqs: [
      {
        q: "How often should I have a check-up?",
        a: "It varies from person to person. Your dentist will recommend an interval based on the health of your teeth and gums.",
      },
    ],
    published: false,
    bookable: false,
    order: 2,
  },
  {
    slug: "teeth-cleaning",
    title: "Teeth Cleaning (Scaling and Polishing)",
    summary: "Professional removal of plaque and hardened deposits (tartar) that brushing at home cannot remove.",
    sections: [
      {
        heading: "What teeth cleaning is",
        paragraphs: [
          "Over time, plaque can harden into tartar on the teeth, especially along the gum line. Scaling removes these deposits, and polishing smooths the tooth surface.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "Cleaning is done with special instruments. You may feel vibration or mild sensitivity. Some temporary gum tenderness afterwards is common.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Consider a dental check if your gums bleed when brushing, you notice hard deposits on your teeth, or you have persistent bad breath.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does cleaning weaken the teeth?",
        a: "Professional cleaning removes deposits from the tooth surface. Your dentist can answer any specific concerns before the procedure.",
      },
    ],
    published: false,
    bookable: false,
    order: 3,
  },
  {
    slug: "dental-fillings",
    title: "Dental Fillings",
    summary: "Repairing teeth affected by decay or minor damage by restoring their shape and function.",
    sections: [
      {
        heading: "What a filling is",
        paragraphs: [
          "When decay damages part of a tooth, the affected area is removed and the space is filled with a suitable material to restore the tooth.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The dentist will explain the procedure and the material options. Local anaesthetic may be used so you are comfortable during treatment.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "See a dentist if you have sensitivity to sweet, hot or cold food, a visible hole or dark spot on a tooth, or food regularly getting stuck between teeth.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which filling material is right for me?",
        a: "It depends on the tooth, the size of the cavity and other factors. Your dentist will explain the options available.",
      },
    ],
    published: false,
    bookable: false,
    order: 4,
  },
  {
    slug: "root-canal-treatment",
    title: "Root Canal Treatment",
    summary: "Treatment for infection or inflammation inside a tooth, aiming to save the natural tooth.",
    sections: [
      {
        heading: "What root canal treatment is",
        paragraphs: [
          "Inside each tooth is soft tissue called the pulp. If it becomes infected or inflamed, root canal treatment cleans the inside of the tooth and seals it.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "Treatment is carried out under local anaesthetic and may need more than one visit. Many teeth need a crown afterwards; your dentist will advise you.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "See a dentist if you have lingering pain to hot or cold, pain when chewing, swelling near a tooth, or a tooth that has darkened.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is root canal treatment painful?",
        a: "The procedure is done with local anaesthetic. Some tenderness afterwards is common; your dentist will explain aftercare.",
      },
    ],
    published: false,
    bookable: false,
    order: 5,
  },
  {
    slug: "tooth-extraction",
    title: "Tooth Extraction",
    summary: "Removal of a tooth when it cannot be saved or when removal is advised for your oral health.",
    sections: [
      {
        heading: "When an extraction may be needed",
        paragraphs: [
          "A tooth may need to be removed if it is badly broken or decayed, loose due to gum disease, or causing problems because of its position.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The area is numbed with local anaesthetic. You will receive written or verbal aftercare instructions. Tell the dentist about all medicines you take, especially blood thinners.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Book an assessment for a painful, loose or broken tooth. Your dentist will discuss whether the tooth can be saved and what the alternatives are.",
        ],
      },
    ],
    faqs: [
      {
        q: "What should I do after an extraction?",
        a: "Follow the aftercare instructions given at the clinic. Contact the clinic if bleeding, pain or swelling increases instead of settling.",
      },
    ],
    published: false,
    bookable: false,
    order: 6,
  },
  {
    slug: "crowns-and-bridges",
    title: "Crowns and Bridges",
    summary: "Caps that cover and protect damaged teeth, and fixed bridges that replace missing teeth.",
    sections: [
      {
        heading: "What crowns and bridges are",
        paragraphs: [
          "A crown covers a weakened or heavily restored tooth. A bridge replaces one or more missing teeth by attaching to the teeth on either side of the gap.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "Usually at least two visits: one to prepare the tooth and take measurements, and another to fit the final crown or bridge.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Consider an assessment if you have a cracked or heavily filled tooth, a tooth treated with root canal, or a gap from a missing tooth.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I care for a crown or bridge?",
        a: "Brush and clean between teeth carefully. Your dentist will show you how to clean under a bridge.",
      },
    ],
    published: false,
    bookable: false,
    order: 7,
  },
  {
    slug: "dentures",
    title: "Dentures",
    summary: "Removable replacements for some or all missing teeth.",
    sections: [
      {
        heading: "What dentures are",
        paragraphs: [
          "Dentures are removable appliances that replace missing teeth. Partial dentures replace some teeth; complete dentures replace all teeth in a jaw.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "Making dentures takes several visits for measurements, trials and fitting. New dentures can take some time to get used to; adjustments may be needed.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Book an assessment if missing teeth make eating or speaking difficult, or if existing dentures are loose, broken or uncomfortable.",
        ],
      },
    ],
    faqs: [
      {
        q: "How should I clean my dentures?",
        a: "Your dentist will explain how to clean and store your dentures, and how often to have them checked.",
      },
    ],
    published: false,
    bookable: false,
    order: 8,
  },
  {
    slug: "cosmetic-dentistry",
    title: "Cosmetic Dentistry",
    summary: "Treatments focused on the appearance of your teeth, discussed after a full dental check.",
    sections: [
      {
        heading: "What cosmetic dentistry is",
        paragraphs: [
          "Cosmetic treatments aim to improve the look of teeth, for example their colour, shape or alignment. Suitable options depend on the health of your teeth and gums.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The dentist will examine your teeth, discuss what you would like to change, and explain which options are suitable, along with their limitations.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "If you are unhappy with how your teeth look, a consultation is the first step to understanding what may be possible for you.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are results the same for everyone?",
        a: "No. Results vary between individuals. The dentist will explain realistic expectations for your situation.",
      },
    ],
    published: false,
    bookable: false,
    order: 9,
  },
  {
    slug: "teeth-whitening",
    title: "Teeth Whitening",
    summary: "Professionally supervised lightening of natural tooth colour, after checking it is suitable for you.",
    sections: [
      {
        heading: "What teeth whitening is",
        paragraphs: [
          "Whitening uses approved products to lighten the natural colour of teeth. It does not change the colour of fillings, crowns or dentures.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "A dental check comes first to make sure whitening is suitable. Temporary sensitivity is a common side effect.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Ask about whitening if staining bothers you. Sudden darkening of a single tooth should be checked by a dentist, as it may need a different treatment.",
        ],
      },
    ],
    faqs: [
      {
        q: "How long does whitening last?",
        a: "It varies with diet, habits and oral hygiene. Your dentist will explain what to expect for you.",
      },
    ],
    published: false,
    bookable: false,
    order: 10,
  },
  {
    slug: "pediatric-dentistry",
    title: "Children's Dentistry",
    summary: "Gentle dental care and advice for children, from their first teeth onwards.",
    sections: [
      {
        heading: "Dental care for children",
        paragraphs: [
          "Children's teeth need care from the time the first tooth appears. Check-ups help spot decay early and build good habits.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The dentist will examine your child's teeth, explain any findings to you, and give advice on brushing, diet and habits. A parent or guardian should accompany the child.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Book a visit if your child has toothache, visible dark spots on teeth, swelling, or a tooth injury.",
        ],
      },
    ],
    faqs: [
      {
        q: "When should my child first see a dentist?",
        a: "Ask the dentist at your visit; generally an early check after the first teeth appear is helpful.",
      },
    ],
    published: false,
    bookable: false,
    order: 11,
  },
  {
    slug: "gum-care",
    title: "Gum Care",
    summary: "Assessment and treatment of gum problems such as bleeding, swelling and gum disease.",
    sections: [
      {
        heading: "Why gum health matters",
        paragraphs: [
          "Healthy gums support your teeth. Gum disease often starts with bleeding or swollen gums and, if not managed, can affect the bone that holds teeth in place.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The dentist will check your gums and may recommend professional cleaning and changes to your home care. Further treatment depends on what is found.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "See a dentist if your gums bleed, are swollen or receding, if teeth feel loose, or if you have persistent bad breath.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is it normal for gums to bleed when brushing?",
        a: "Bleeding gums are a common sign of gum inflammation and should be checked by a dentist.",
      },
    ],
    published: false,
    bookable: false,
    order: 12,
  },
  {
    slug: "orthodontic-consultation",
    title: "Orthodontic Consultation",
    summary: "An assessment of tooth and jaw alignment and a discussion of possible next steps.",
    sections: [
      {
        heading: "What an orthodontic consultation is",
        paragraphs: [
          "Orthodontics deals with the alignment of teeth and jaws. A consultation assesses your bite and alignment and explains whether treatment may help.",
        ],
      },
      {
        heading: "What to expect",
        paragraphs: [
          "The dentist will examine your teeth and bite and may recommend records such as X-rays or impressions. Options and next steps will be discussed with you.",
        ],
      },
      {
        heading: "When to seek an assessment",
        paragraphs: [
          "Consider a consultation for crowded, gapped or protruding teeth, or difficulty biting or chewing.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is there an age limit for orthodontic treatment?",
        a: "Suitability depends on individual factors. The dentist will advise after an assessment.",
      },
    ],
    published: false,
    bookable: false,
    order: 13,
  },
];
