import { redirect } from 'next/navigation'

// Unified into `properties`; forward legacy listing detail URLs to the property.
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/properties/${id}`)
}
