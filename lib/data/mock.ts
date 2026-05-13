/** Dati fittizi per le prime viste. Sostituisci con `supabase.from('...')` in seguito. */

import type { KanbanStatus } from "@/lib/types";

export type MockBrand = {
  id: string;
  name: string;
  sector: string | null;
  contacts: string | null;
};

export type MockCollaboration = {
  id: string;
  title: string;
  brandName: string;
  agreedFee: string | null;
  isGiveaway?: boolean;
  giveawayValue?: string | null;
  kanbanStatus: KanbanStatus;
};

const brands: MockBrand[] = [
  {
    id: "b1",
    name: "Caffè Lento",
    sector: "F&B",
    contacts: "marketing@caffelento.example",
  },
  {
    id: "b2",
    name: "TechRun",
    sector: "Tecnologia",
    contacts: "pr@techrun.example",
  },
  {
    id: "b3",
    name: "Outdoor Co.",
    sector: "Sport",
    contacts: "collab@outdoor.example",
  },
  {
    id: "b4",
    name: "Beauty Lab",
    sector: "Beauty",
    contacts: "creator@beautylab.example",
  },
];

const collaborations: MockCollaboration[] = [
  {
    id: "c1",
    title: "Lancio estate – serie shorts",
    brandName: "Caffè Lento",
    agreedFee: "1.200 €",
    kanbanStatus: "nuove",
  },
  {
    id: "c2",
    title: "Review prodotto smartwatch",
    brandName: "TechRun",
    agreedFee: "2.500 €",
    kanbanStatus: "in_trattativa",
  },
  {
    id: "c3",
    title: "Campagna trekking",
    brandName: "Outdoor Co.",
    agreedFee: "1.800 €",
    kanbanStatus: "in_trattativa",
  },
  {
    id: "c4",
    title: "Tutorial trucco evento",
    brandName: "Beauty Lab",
    agreedFee: "900 €",
    kanbanStatus: "accettate",
  },
  {
    id: "c5",
    title: "Unboxing caffè specialty",
    brandName: "Caffè Lento",
    agreedFee: "1.000 €",
    kanbanStatus: "accettate",
  },
  {
    id: "c6",
    title: "LIVE Black Friday 2024",
    brandName: "TechRun",
    agreedFee: "3.000 €",
    kanbanStatus: "completate",
  },
];

export async function getMockBrands(): Promise<MockBrand[]> {
  await new Promise((r) => setTimeout(r, 150));
  return brands;
}

export async function getMockCollaborations(): Promise<MockCollaboration[]> {
  await new Promise((r) => setTimeout(r, 150));
  return collaborations;
}

export async function getMockDashboardStats() {
  await new Promise((r) => setTimeout(r, 80));
  return {
    openCollaborations: 4,
    thisMonthEarnings: "4.200 €",
    nextDeadline: { label: "Reel Instagram", when: "30 apr" },
  };
}

export type MockCalendarEvent = {
  id: string;
  day: string;
  title: string;
  type: "shoot" | "post" | "meeting";
};

export async function getMockCalendarEvents(): Promise<MockCalendarEvent[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [
    { id: "e1", day: "28 apr", title: "Giro caffè – riprese", type: "shoot" },
    { id: "e2", day: "29 apr", title: "Pubblicazione Reel", type: "post" },
    { id: "e3", day: "2 mag", title: "Call briefing TechRun", type: "meeting" },
  ];
}

export type MockFinancial = {
  id: string;
  type: string;
  amount: string;
  date: string;
  collaboration: string | null;
};

export async function getMockFinancials(): Promise<MockFinancial[]> {
  await new Promise((r) => setTimeout(r, 120));
  return [
    {
      id: "f1",
      type: "Entrata Sponsor",
      amount: "+ 1.200,00 €",
      date: "12 apr 2026",
      collaboration: "Lancio estate – shorts",
    },
    {
      id: "f2",
      type: "Entrata YouTube",
      amount: "+ 320,00 €",
      date: "10 apr 2026",
      collaboration: null,
    },
    {
      id: "f3",
      type: "Spesa Materiale",
      amount: "− 89,00 €",
      date: "8 apr 2026",
      collaboration: "Campagna trekking",
    },
  ];
}
