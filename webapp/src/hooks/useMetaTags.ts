import { useEffect } from "react";

interface MetaOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
}

export function useMetaTags(options: MetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    const defaultTitle = "InvoiceFlow — Professional Invoice Generator";

    if (options.title) {
      document.title = options.title;
    } else {
      document.title = defaultTitle;
    }

    const setMetaTag = (name: string, content: string, attr: string = "name") => {
      const existing = document.querySelector(`meta[${attr}="${name}"]`);
      if (existing) {
        existing.setAttribute("content", content);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        meta.setAttribute("content", content);
        document.head.appendChild(meta);
      }
    };

    if (options.description) {
      setMetaTag("description", options.description);
      setMetaTag("og:description", options.description, "property");
      setMetaTag("twitter:description", options.description, "name");
    }

    if (options.title) {
      setMetaTag("og:title", options.title, "property");
      setMetaTag("twitter:title", options.title, "name");
    }

    if (options.image) {
      setMetaTag("og:image", options.image, "property");
      setMetaTag("og:image:alt", options.description ?? options.title ?? "", "property");
      setMetaTag("twitter:image", options.image, "name");
      setMetaTag("twitter:image:alt", options.description ?? options.title ?? "", "property");
    }

    if (options.url) {
      setMetaTag("og:url", options.url, "property");
    } else {
      setMetaTag("og:type", "website", "property");
    }

    if (options.noIndex) {
      const robots = document.querySelector('meta[name="robots"]');
      const metaRobots = robots || document.createElement("meta");
      metaRobots.setAttribute("name", "robots");
      metaRobots.setAttribute("content", "noindex, nofollow");
      if (!robots) document.head.appendChild(metaRobots);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [options]);
}
