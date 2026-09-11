import type { ImageMetadata } from "astro";

export type Project = {
  title: string;
  url: string;
  slug: string;
  description?: string;
  heroImage?: ImageMetadata;
  starsUrl?: string;
  tags?: string[];
  longDescription?: string;
  features?: string[];
  techStack?: string[];
  installation?: string;
  usage?: string;
  screenshots?: ImageMetadata[];
  demoUrl?: string;
  documentationUrl?: string;
  license?: string;
};

export type ProjectDetails = Omit<
  Project,
  "url" | "slug"
> & {
  repositoryUrl: string;
  githubStars?: string;
  githubForks?: string;
  contributors?: Array<{
    name: string;
    url: string;
    avatar?: string;
  }>;
  roadmap?: Array<{
    title: string;
    status: "completed" | "in-progress" | "planned";
  }>;
  changelog?: Array<{
    version: string;
    date: string;
    changes: string[];
  }>;
};
