import type { PageText } from "../ragStore";

/* Built-in sample document — a fictional credit-card product guide.
   It intentionally mirrors the CDP journey demo: this is the travel card
   Mirza was recommended. Used by Play Mode and the "load sample" button. */

export const SAMPLE_NAME = "aurora-voyager-travel-card-guide.pdf (sample)";

export const SAMPLE_QUESTION =
  "What travel benefits does the Voyager card include, and who is eligible to apply?";

export const SAMPLE_PAGES: PageText[] = [
  {
    page: 1,
    text: `Aurora Bank Voyager Travel Credit Card — Product & Policy Guide. Edition 4.2, January 2026.

The Aurora Voyager is a premium travel rewards credit card designed for frequent international travellers. Cardmembers earn 5 reward points per dollar on airline and hotel purchases, 3 points per dollar on dining, and 1 point per dollar on all other spend. Points never expire while the account remains open and in good standing.

The card carries an annual fee of 4,999 rupees, waived in the first year and waived in any renewal year in which total annual spend exceeds 400,000 rupees. There is no over-limit fee. Late payment fees range from 500 to 1,300 rupees depending on the outstanding balance.`,
  },
  {
    page: 2,
    text: `Travel Benefits. Voyager cardmembers receive unlimited complimentary access to over 1,200 airport lounges worldwide through the Aurora LoungeKey programme, including 4 guest passes per calendar year. Additional guest visits are charged at 27 US dollars per visit.

The card charges zero foreign transaction fees on all international purchases — a saving of the typical 3.5 percent markup. Cardmembers also receive complimentary travel insurance: up to 100,000 US dollars in air accident cover, lost baggage protection up to 1,500 US dollars, and trip delay cover of 250 US dollars for delays beyond six hours.

Flight bookings made through the Aurora Travel portal earn an additional 2 bonus points per dollar and include free seat selection on partner airlines.`,
  },
  {
    page: 3,
    text: `Eligibility and Application. Applicants must be between 21 and 65 years of age with a minimum annual income of 1.2 million rupees for salaried individuals or 1.5 million rupees for the self-employed. A credit bureau score of 750 or above is recommended for approval.

Existing Aurora Bank customers with at least 12 months of relationship history may qualify for a pre-approved offer with instant digital issuance. New customers complete a full application with PAN details, address proof, and e-sign consent; a decision is typically returned within 48 hours.

Applications abandoned midway are saved securely for 30 days. Applicants can resume from where they left off using the reference number sent by SMS and email.`,
  },
  {
    page: 4,
    text: `Rewards Redemption. Points can be redeemed for flights and hotels on the Aurora Travel portal at a value of 1 rupee per point, transferred to 14 airline and hotel loyalty partners at ratios between 1:1 and 2:1, or used as statement credit at 0.4 rupees per point. Transfers to partners are processed within 72 hours.

A welcome bonus of 10,000 points is credited after the first purchase, and a milestone bonus of 15,000 points is credited on reaching 300,000 rupees of spend in an anniversary year.

Interest and Charges. The monthly finance charge on revolving balances is 3.1 percent (annualised 37.2 percent). Cash advances carry a 2.5 percent fee, minimum 500 rupees, and accrue interest from the transaction date.`,
  },
  {
    page: 5,
    text: `Data Privacy and Consent. Aurora Bank collects application and transaction data to provide card services, prevent fraud, and — only with explicit customer consent — to personalise offers. Customers control marketing, analytics, and third-party data-sharing preferences independently in the Privacy Centre, and may withdraw consent at any time with immediate effect.

Aurora Bank never sells personal data. AI-driven recommendations are reviewed under a human-in-the-loop policy: no automated marketing decision is executed without human approval.

Customer Support. Voyager cardmembers have access to a 24/7 priority support line, in-app chat with a 90-second average response time, and a dedicated relationship manager for accounts with annual spend above 1 million rupees. Disputes are acknowledged within 24 hours and resolved within 7 working days on average.`,
  },
];
