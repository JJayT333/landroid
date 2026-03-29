/** Left panel — search, filter, sortable owner list. */
import OwnerListToolbar from './OwnerListToolbar';
import OwnerListTable from './OwnerListTable';

interface Props {
  onNewOwner: () => void;
  onExport: () => void;
}

export default function OwnerListPanel({ onNewOwner, onExport }: Props) {
  return (
    <div className="flex flex-col h-full border-r border-ledger-line bg-parchment">
      <OwnerListToolbar onNewOwner={onNewOwner} onExport={onExport} />
      <OwnerListTable />
    </div>
  );
}
