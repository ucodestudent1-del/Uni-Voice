import { useEffect } from "react";

interface MetaOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
  canonical?: string;
}

const DEFAULT_TITLE = "DocForge — Professional Invoice Generator";

export function useMetaTags(options: MetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;

    const title = options.title ?? DEFAULT_TITLE;
    document.title = title;

    const head = document.head;

    const setMetaTag = (name: string, content: string, attr: string = "name") => {
      const existing = head.querySelector(`meta[${attr}="${name}"]`);
      if (existing) {
        existing.setAttribute("content", content);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        meta.setAttribute("content", content);
        head.appendChild(meta);
      }
    };

    const setLinkTag = (rel: string, href: string) => {
      const existing = head.querySelector(`link[rel="${rel}"]`);
      if (existing) {
        existing.setAttribute("href", href);
      } else {
        const link = document.createElement("link");
        link.setAttribute("rel", rel);
        link.setAttribute("href", href);
        head.appendChild(link);
      }
    };

    if (options.description) {
      setMetaTag("description", options.description);
      setMetaTag("og:description", options.description, "property");
      setMetaTag("twitter:description", options.description, "name");
    }

    setMetaTag("og:title", title, "property");
    setMetaTag("twitter:title", title, "name");

    if (options.image) {
      setMetaTag("og:image", options.image, "property");
      setMetaTag("og:image:alt", options.description ?? title, "property");
      setMetaTag("twitter:image", options.image, "name");
      setMetaTag("twitter:image:alt", options.description ?? title, "name");
    }

    if (options.url) {
      setMetaTag("og:url", options.url, "property");
      setMetaTag("og:type", "website", "property");
      setLinkTag("canonical", options.url);
    } else {
      setMetaTag("og:type", "website", "property");
      setMetaTag("og:locale", "en-US", "property");
    }

    if (options.canonical) {
      setLinkTag("canonical", options.canonical);
    }

    if (options.noIndex) {
      setMetaTag("robots", "noindex, nofollow", "name");
    } else {
      const robots = head.querySelector('meta[name="robots"]');
      if (robots) robots.setAttribute("content", "index, follow");
    }

    return () => {
      document.title = previousTitle;
    };
  }, [options]);
}
