import { redirect } from 'next/navigation'

// The listings catalog was unified into `properties`. Keep the URL working by
// redirecting to the canonical browse page.
export default function ListingsPage() {
  redirect('/properties')
}
