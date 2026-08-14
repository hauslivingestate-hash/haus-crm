import { Topbar } from "@/components/Topbar";
import { ContactsBrowser } from "@/components/ContactsBrowser";
import { getContacts } from "@/lib/queries";

// Merged live from main_2_owner + main_6_buyer_crm — there is no contacts table.
// See lib/contacts.ts for why.
export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <>
      <Topbar
        title="ผู้ติดต่อ"
        subtitle={`เจ้าของทรัพย์และลูกค้าที่คุณเห็น · ${contacts.length} ราย`}
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <ContactsBrowser contacts={contacts} />
      </div>
    </>
  );
}
