import { redirect } from 'next/navigation'

// Property creation is unified on the `properties` dashboard flow.
export default function NewListingRedirect() {
  redirect('/landlord/properties/new')
}
