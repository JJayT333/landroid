/** Contact log timeline + add button. */
import { useState } from 'react';
import { useOwnerStore } from '../../store/owner-store';
import { createBlankContact } from '../../types/owner';
import type { ContactLog } from '../../types/owner';
import ContactLogEntry from './ContactLogEntry';
import ContactLogModal from '../modals/ContactLogModal';

interface Props {
  ownerId: string;
}

export default function OwnerContactsTab({ ownerId }: Props) {
  const contacts = useOwnerStore((s) => s.activeContacts);
  const addContact = useOwnerStore((s) => s.addContact);
  const removeContact = useOwnerStore((s) => s.removeContact);
  const [showModal, setShowModal] = useState(false);

  const handleSave = (entry: ContactLog) => {
    addContact(entry);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this contact log entry?')) {
      removeContact(id);
    }
  };

  // Separate overdue follow-ups
  const today = new Date().toISOString().slice(0, 10);
  const overdue = contacts.filter(
    (c) => c.followUpDate && !c.followUpCompleted && c.followUpDate < today
  );

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wider">
          Contact Log ({contacts.length})
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
        >
          + Log Contact
        </button>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-medium">
          {overdue.length} overdue follow-up{overdue.length > 1 ? 's' : ''}
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-10 text-sm text-ink-light/50">
          No contacts logged yet.
        </div>
      ) : (
        <div className="pt-2">
          {contacts.map((entry) => (
            <ContactLogEntry
              key={entry.id}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ContactLogModal
          entry={createBlankContact(ownerId)}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
