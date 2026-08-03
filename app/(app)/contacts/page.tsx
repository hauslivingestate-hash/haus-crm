import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/Button";
import { ContactsBrowser } from "@/components/ContactsBrowser";
import { listContacts } from "@/lib/contacts";

export default function ContactsPage() {
  const contacts = listContacts();

  return (
    <>
      <Topbar
        title="ผู้ติดต่อ"
        subtitle={`ฐานข้อมูลส่วนกลาง · ${contacts.length} ราย`}
        actions={
          <Button size="sm" disabled>
            + เพิ่มผู้ติดต่อ
          </Button>
        }
      />
      <div className="p-4 lg:p-6">
        <ContactsBrowser contacts={contacts} />
      </div>
    </>
  );
}
