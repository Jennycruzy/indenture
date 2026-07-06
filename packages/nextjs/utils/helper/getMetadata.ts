import type { Metadata } from "next";

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const titleTemplate = "%s | CLOISTRA";

export const getMetadata = ({
  title,
  description,
  imageRelativePath,
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const images = imageRelativePath ? [{ url: `${baseUrl}${imageRelativePath}` }] : undefined;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images,
    },
    twitter: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images,
    },
    icons: {
      icon: [
        {
          url: "/favicon.svg",
          type: "image/svg+xml",
        },
      ],
    },
  };
};
