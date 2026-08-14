export type DocumentKind = "start" | "guides" | "packages" | "react";

export interface DocumentationRecord {
  id: string;
  uri: string;
  route: string;
  url: string;
  sourcePath: string;
  kind: DocumentKind;
  title: string;
  description: string;
  body: string;
}

export interface BrowserSupportRecord {
  capability: string;
  package: string;
  chrome: string;
  edge: string;
  fallback: string;
  sources: string[];
}

export interface DocumentationCatalog {
  documents: DocumentationRecord[];
  browserSupport: BrowserSupportRecord[];
}

export interface DocumentationSearchResult {
  id: string;
  uri: string;
  url: string;
  title: string;
  description: string;
  kind: DocumentKind;
  excerpt: string;
}
