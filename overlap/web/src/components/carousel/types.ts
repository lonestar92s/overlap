export interface CarouselMatch {
  id: string;
  homeTeam: {
    name: string;
    crest?: string;
  };
  awayTeam: {
    name: string;
    crest?: string;
  };
  stadium: {
    name: string;
    city: string;
    country: string;
  };
  kickoff: string;
  competition: {
    name: string;
  };
} 