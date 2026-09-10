export interface GuideScreenshot {
  src: string;
  alt: string;
  caption: string;
  markers?: { x: number; y: number; label: string; description: string }[];
}

export interface GuideStep {
  title: string;
  description: string;
}

export interface GuideArticle {
  id: string;
  title: string;
  summary: string;
  path: string;
  prerequisites: string[];
  steps: GuideStep[];
  verification: string[];
  tips?: string[];
  related?: string[];
}

export interface GuideModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  articles: GuideArticle[];
}
