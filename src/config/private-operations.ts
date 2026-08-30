import { features } from "./features";

export const privateOperationsPresentation = (): Readonly<{ slug: string; apiUrl: string }> | undefined => {
  if (!features.commerceOperationsUi) return undefined;
  const slug=import.meta.env.PUBLIC_COMMERCE_OPERATIONS_SLUG?.trim();
  const api=import.meta.env.PUBLIC_COMMERCE_OPERATIONS_API_URL?.trim();
  if(!slug||!api||!/^[a-z0-9-]+$/.test(slug))throw new Error("Private operations UI requires an explicit slug and API URL.");
  const url=new URL(api); if(url.protocol!=="https:"&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error("Private operations API must use HTTPS outside local development.");
  return Object.freeze({slug,apiUrl:url.href.replace(/\/$/,"")});
};
