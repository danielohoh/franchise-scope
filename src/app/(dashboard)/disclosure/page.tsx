import { DisclosureListClient } from "./_components/DisclosureListClient";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function DisclosurePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const brandId = typeof sp.brand_id === "string" ? sp.brand_id : null;

  return <DisclosureListClient initialBrandId={brandId} />;
}
