const { useState, useMemo, useRef, useEffect } = React;
const { flushSync } = ReactDOM;
const appId = 'default-app-id';

const workspaceStorageApi = globalThis.LANDroidWorkspaceStorage;
if (!workspaceStorageApi) {
    throw new Error('LANDroidWorkspaceStorage API is unavailable. Ensure dist/workspaceStorage.js is loaded before app.jsx.');
}

const storageProviderApi = globalThis.LANDroidStorageProvider || {};
const createLocalStorageProvider = storageProviderApi.createLocalStorageProvider;
if (!createLocalStorageProvider) {
    throw new Error('LANDroidStorageProvider API is unavailable. Ensure dist/storageProvider.js is loaded before app.jsx.');
}

const workspaceProvider = createLocalStorageProvider(workspaceStorageApi);
const {
    getLastWorkspaceId,
    listWorkspaces,
    loadWorkspace,
    saveWorkspace,
    deleteWorkspace,
    deleteAllWorkspaces,
    getLatestWorkspace,
} = workspaceProvider;

const workspaceDomainApi = globalThis.LANDroidWorkspaceDomain || {};
const toWorkspaceSavePayload = workspaceDomainApi.toWorkspaceSavePayload || ((state) => state);
const fromStoredWorkspace = workspaceDomainApi.fromStoredWorkspace || ((payload) => payload);

const auditLogApi = globalThis.LANDroidAuditLog || {};
const recordAuditEvent = auditLogApi.recordAuditEvent || (() => null);

const syncEngineApi = globalThis.LANDroidSyncEngine || {};
const recordSyncOperation = syncEngineApi.recordSyncOperation || (() => null);
const getSyncSummary = syncEngineApi.getSyncSummary || (() => ({ pendingCount: 0, status: 'synced', lastOperationAt: null }));

const Icon = ({ name, size = 18, className = "" }) => {
            const icons = {
                Plus: <path d="M12 5v14M5 12h14" />,
                Minus: <path d="M5 12h14" />,
                Trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
                Download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
                Upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
                Printer: <path d="M6 9V2h12v7M6 18H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-2M6 14h12v8H6v-8z" />,
                List: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
                Close: <path d="M18 6L6 18M6 6l12 12" />,
                Eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
                Convey: <><path d="M21 3L14.3 21.4a.5.5 0 0 1-.9 0L10 14l-7.4-3.4a.5.5 0 0 1 0-.9L21 3Z" /><path d="M21 3L10 14" /></>,
                ArrowUp: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>,
                Cpu: <><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" /></>,
                Chart: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /></>,
                FileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
                Paperclip: <><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></>,
                Clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
                Link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
                Cloud: <><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></>,
                Tombstone: <><path d="M7 2h10a5 5 0 0 1 5 5v15H2V7a5 5 0 0 1 5-5z" /><line x1="12" y1="5" x2="12" y2="12" /><line x1="9" y1="8" x2="15" y2="8" /></>,
                Flowchart: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="9" y="15" width="6" height="6" rx="1" /><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" /><line x1="12" y1="13" x2="12" y2="15" /></>,
                MousePointer: <><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></>,
                Move: <><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="19 9 22 12 19 15" /><polyline points="9 19 12 22 15 19" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></>,
                Hand: <><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V3a2 2 0 0 0-4 0v9"/><path d="M6 12v-1a2 2 0 0 0-4 0v5a10 10 0 0 0 20 0v-5a2 2 0 0 0-4 0v-4.5"/></>,
                Users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></>,
                Table: <><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></>,
                MapPin: <><path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z"/><circle cx="12" cy="11" r="2.5"/></>,
            };
            return (
                <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    {icons[name] || null}
                </svg>
            );
        };

        const App = () => {
            const makeId = () => Math.random().toString(36).slice(2, 11);
            const defaultRoot = {
                id: 'root', instrument: 'Original Grant', vol: '', page: '', docNo: 'LAND_GRANT_001',
                fileDate: '1836-03-02', date: '1836-03-02', grantor: 'State Government', grantee: 'Original Grantee', 
                landDesc: 'All that certain tract...', remarks: 'Root of Title',
                fraction: 1.0, initialFraction: 1.0, parentId: null, docData: '', type: 'conveyance',
                isDeceased: false, obituary: '', graveyardLink: ''
            };
            const defaultViewport = { x: 0, y: 0, scale: 1 };
            const defaultFlowViewport = { x: 0, y: 0, scale: 1 };
            const defaultFlowGrid = { cols: 1, rows: 1 };
            const createDeskMap = ({ name = 'Unit Tract 1', code = 'TRACT-1', tractId = null } = {}) => ({
                id: makeId(),
                name,
                code,
                tractId,
                nodes: [{ ...defaultRoot }],
                pz: { ...defaultViewport }
            });

            const [nodes, setNodes] = useState([defaultRoot]);
            const [deskMaps, setDeskMaps] = useState([createDeskMap()]);
            const [activeDeskMapId, setActiveDeskMapId] = useState('');
            const skipDeskMapSyncRef = useRef(false);
            const [view, setView] = useState('chart'); 
            const [showModal, setShowModal] = useState(false);
            const [modalMode, setModalMode] = useState('edit'); 
            const [activeNode, setActiveNode] = useState(null);
            const [viewerData, setViewerData] = useState(null);
            const [showOnlyConveyances, setShowOnlyConveyances] = useState(false);
            const [runsheetDeskMapFilter, setRunsheetDeskMapFilter] = useState('active');
            const [flowDeskMapFilter, setFlowDeskMapFilter] = useState('active');
            const [deskMapNameDraft, setDeskMapNameDraft] = useState('');
            const [deskMapCodeDraft, setDeskMapCodeDraft] = useState('');
            const [isEditingDeskMapName, setIsEditingDeskMapName] = useState(false);
            
            // PERFORMANCE: Defer massive print grid DOM rendering until exact moment of printing
            const [isPrinting, setIsPrinting] = useState(false);

            // -------------------------------------------------------------
            // FLOWCHART ENGINE STATE
            // -------------------------------------------------------------
            const [flowNodes, setFlowNodes] = useState([]);
            const [flowEdges, setFlowEdges] = useState([]);
            const [flowTool, setFlowTool] = useState('select'); 
            const [flowPz, setFlowPz] = useState({ ...defaultFlowViewport });
            const [treeScale, setTreeScale] = useState(1); 
            const [gridCols, setGridCols] = useState(defaultFlowGrid.cols);
            const [gridRows, setGridRows] = useState(defaultFlowGrid.rows);
            const [connectingStart, setConnectingStart] = useState(null);
            const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
            const [selectedFlowNode, setSelectedFlowNode] = useState(null);
            const [showFlowEditModal, setShowFlowEditModal] = useState(false);
            const [flowForm, setFlowForm] = useState(null);
            const [printOrientation, setPrintOrientation] = useState('landscape');
            const [showFlowLayoutMenu, setShowFlowLayoutMenu] = useState(false);
            const [showActionsMenu, setShowActionsMenu] = useState(false);
            
            const flowDraggingNode = useRef(null);
            const flowDragStart = useRef({ x: 0, y: 0 });
            const flowCanvasRef = useRef(null);
            const flowLayoutMenuRef = useRef(null);
            const actionsMenuRef = useRef(null);
            
            const moveTreeStartPos = useRef(null);
            const initialTreeNodes = useRef(null);
            const moveTreeGroupId = useRef(null);

            // Dynamic Paper Size Calculation (96 DPI)
            const pw = printOrientation === 'landscape' ? 1056 : 816; // 11" vs 8.5"
            const ph = printOrientation === 'landscape' ? 816 : 1056; // 8.5" vs 11"
            
            // Standard App State
            const [lastMathProps, setLastMathProps] = useState({ conveyanceMode: 'fraction', splitBasis: 'initial', numerator: 1, denominator: 2, manualAmount: 0 });
            const [savedProjects, setSavedProjects] = useState([]);
            const [showCloudModal, setShowCloudModal] = useState(false);
            const [showHome, setShowHome] = useState(true);
            const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
            const [projectName, setProjectName] = useState('My Workspace');
            const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
            const [isSaving, setIsSaving] = useState(false);
            const [isOnline, setIsOnline] = useState(navigator.onLine);
            const [bootChecks, setBootChecks] = useState({ offlineModeActive: false, cloudSyncUnavailable: false });
            const [syncSummary, setSyncSummary] = useState(() => getSyncSummary());
            const [confirmAction, setConfirmAction] = useState(null); 
            const [attachParentId, setAttachParentId] = useState('root');
            const [attachType, setAttachType] = useState('conveyance');
            const fileInput = useRef(null);
            const modalUploadRef = useRef(null);
            const [pz, setPz] = useState({ ...defaultViewport });
            const isDragging = useRef(false);
            const dragStart = useRef({ x: 0, y: 0 });

            const [form, setForm] = useState({
                instrument: '', vol: '', page: '', docNo: '', fileDate: '', date: '', grantor: '', grantee: '', 
                landDesc: '', remarks: '', fraction: 0, initialFraction: 0, docData: '', conveyanceMode: 'fraction', 
                splitBasis: 'initial', type: 'conveyance', numerator: 1, denominator: 2, manualAmount: 0, 
                isDeceased: false, obituary: '', graveyardLink: ''
            });

            const [instrumentList, setInstrumentList] = useState([
                'Warranty Deed', 'Quitclaim Deed', 'Mineral Deed', 'Royalty Deed', 'Deed of Trust', 
                'Oil & Gas Lease', 'Affidavit of Heirship', 'Probate', 'Patent', 'Release', 'Assignment', 
                'Right of Way', 'Easement', 'Correction Deed', 'Original Grant'
            ]);
            const [isAddingInst, setIsAddingInst] = useState(false);
            const [newInst, setNewInst] = useState('');
            const [showGranteeList, setShowGranteeList] = useState(false);

            // Research Hub (contacts + tracts + matrix + contact logs)
            const [tracts, setTracts] = useState([]);
            const [contacts, setContacts] = useState([]);
            const [ownershipInterests, setOwnershipInterests] = useState([]);
            const [contactLogs, setContactLogs] = useState([]);
            const [selectedContactId, setSelectedContactId] = useState(null);
            const [researchTab, setResearchTab] = useState('contacts');
            const [tractForm, setTractForm] = useState({ code: '', name: '', acres: '', mapId: '' });
            const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '' });
            const [interestForm, setInterestForm] = useState({ contactId: '', tractId: '', interestType: 'MI', interestValue: '', status: 'confirmed' });
            const [logForm, setLogForm] = useState({ contactId: '', tractId: '', method: 'call', outcome: '', nextFollowupAt: '', notes: '' });


            const formatDeskMapLabel = (map) => {
                if (!map) return 'DeskMap';
                const code = (map.code || '').trim();
                const name = (map.name || '').trim();
                if (code && name) return `${code} - ${name}`;
                return code || name || 'DeskMap';
            };

            // PERFORMANCE: Memoized calculated arrays
            const activeOwners = useMemo(() => nodes.filter(n => n.type !== 'related' && n.fraction > 0.00000001), [nodes]);
            const totalRemaining = useMemo(() => activeOwners.reduce((sum, n) => sum + parseFloat(n.fraction), 0), [activeOwners]);
            const uniqueGrantees = useMemo(() => [...new Set(nodes.map(n => n.grantee).filter(Boolean))].sort(), [nodes]);
            
            // PERFORMANCE: Runsheet sorting/filtering memoization
            const runsheetNodesSource = useMemo(() => {
                if (runsheetDeskMapFilter === 'all') {
                    return deskMaps.flatMap(map => (map.nodes || []).map(n => ({ ...n, __deskMapId: map.id, __deskMapLabel: formatDeskMapLabel(map) })));
                }
                if (runsheetDeskMapFilter === 'active') {
                    const activeMap = deskMaps.find(map => map.id === activeDeskMapId);
                    return (activeMap?.nodes || nodes || []).map(n => ({ ...n, __deskMapId: activeMap?.id || activeDeskMapId, __deskMapLabel: activeMap ? formatDeskMapLabel(activeMap) : 'Active DeskMap' }));
                }
                const chosenMap = deskMaps.find(map => map.id === runsheetDeskMapFilter);
                return (chosenMap?.nodes || []).map(n => ({ ...n, __deskMapId: chosenMap?.id, __deskMapLabel: chosenMap ? formatDeskMapLabel(chosenMap) : 'Selected DeskMap' }));
            }, [runsheetDeskMapFilter, deskMaps, activeDeskMapId, nodes]);

            const filteredSortedNodes = useMemo(() => {
                return [...runsheetNodesSource]
                    .sort((a,b) => new Date(a.date) - new Date(b.date))
                    .filter(n => showOnlyConveyances ? (n.type !== 'related' && n.parentId !== 'unlinked') : true);
            }, [runsheetNodesSource, showOnlyConveyances]);

            const tractById = useMemo(() => Object.fromEntries(tracts.map(t => [t.id, t])), [tracts]);
            const contactById = useMemo(() => Object.fromEntries(contacts.map(c => [c.id, c])), [contacts]);
            const interestsByContactAndTract = useMemo(() => {
                const bucket = {};
                ownershipInterests.forEach(item => {
                    const key = `${item.contactId}::${item.tractId}`;
                    if (!bucket[key]) bucket[key] = [];
                    bucket[key].push(item);
                });
                return bucket;
            }, [ownershipInterests]);
            const selectedContact = useMemo(() => selectedContactId ? (contactById[selectedContactId] || null) : null, [contactById, selectedContactId]);
            const selectedContactLogs = useMemo(() => {
                if (!selectedContactId) return [];
                return contactLogs
                    .filter(l => l.contactId === selectedContactId)
                    .sort((a, b) => new Date(b.contactAt) - new Date(a.contactAt));
            }, [contactLogs, selectedContactId]);

            useEffect(() => {
                if (!deskMaps.length) {
                    const fallback = createDeskMap();
                    setDeskMaps([fallback]);
                    setActiveDeskMapId(fallback.id);
                    return;
                }
                if (!activeDeskMapId || !deskMaps.some(map => map.id === activeDeskMapId)) {
                    setActiveDeskMapId(deskMaps[0].id);
                }
            }, [deskMaps, activeDeskMapId]);

            useEffect(() => {
                const activeMap = deskMaps.find(map => map.id === activeDeskMapId);
                if (!activeMap) return;
                skipDeskMapSyncRef.current = true;
                setNodes(activeMap.nodes || [{ ...defaultRoot }]);
                setPz(activeMap.pz || { ...defaultViewport });
            }, [activeDeskMapId, deskMaps]);

            useEffect(() => {
                if (isEditingDeskMapName) return;
                const activeMap = deskMaps.find(map => map.id === activeDeskMapId);
                setDeskMapNameDraft(activeMap?.name || '');
                setDeskMapCodeDraft(activeMap?.code || '');
            }, [activeDeskMapId, deskMaps, isEditingDeskMapName]);

            const updateActiveDeskMapNodes = (updater) => {
                const mapId = activeDeskMapId;
                if (!mapId) return;
                setNodes(prevNodes => {
                    const nextNodes = typeof updater === 'function' ? updater(prevNodes) : updater;
                    setDeskMaps(prevMaps => prevMaps.map(map => map.id === mapId ? { ...map, nodes: nextNodes } : map));
                    return nextNodes;
                });
            };

            useEffect(() => {
                if (!activeDeskMapId) return;
                if (skipDeskMapSyncRef.current) {
                    skipDeskMapSyncRef.current = false;
                    return;
                }
                setDeskMaps(prev => prev.map(map => map.id === activeDeskMapId ? { ...map, nodes, pz } : map));
            }, [nodes, pz, activeDeskMapId]);

            const addDeskMap = () => {
                const mapNumber = deskMaps.length + 1;
                const newMap = createDeskMap({ name: `Unit Tract ${mapNumber}`, code: `TRACT-${mapNumber}` });
                setDeskMaps(prev => [...prev, newMap]);
                setActiveDeskMapId(newMap.id);
            };

            const renameActiveDeskMap = (rawName = deskMapNameDraft, rawCode = deskMapCodeDraft) => {
                const trimmedName = (rawName || '').trim();
                const trimmedCode = (rawCode || '').trim();
                if (!trimmedName && !trimmedCode) return;
                setDeskMaps(prev => prev.map(map => map.id === activeDeskMapId ? {
                    ...map,
                    name: trimmedName || map.name,
                    code: trimmedCode || map.code
                } : map));
                setDeskMapNameDraft(trimmedName);
                setDeskMapCodeDraft(trimmedCode);
                setIsEditingDeskMapName(false);
            };

            useEffect(() => {
                if (!tracts.length) return;
                setDeskMaps(prev => {
                    let updated = [...prev];
                    tracts.forEach(tract => {
                        const exists = updated.some(map => map.tractId === tract.id);
                        if (!exists) {
                            updated.push(createDeskMap({ name: tract.name || tract.code, code: tract.code, tractId: tract.id }));
                        }
                    });
                    return updated;
                });
            }, [tracts]);

            useEffect(() => {
                if (!showFlowLayoutMenu && !showActionsMenu) return;
                const handleMenuDismiss = (event) => {
                    if (showFlowLayoutMenu && flowLayoutMenuRef.current && !flowLayoutMenuRef.current.contains(event.target)) {
                        setShowFlowLayoutMenu(false);
                    }
                    if (showActionsMenu && actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
                        setShowActionsMenu(false);
                    }
                };
                const handleEsc = (event) => {
                    if (event.key !== 'Escape') return;
                    if (showFlowLayoutMenu) setShowFlowLayoutMenu(false);
                    if (showActionsMenu) setShowActionsMenu(false);
                };
                document.addEventListener('mousedown', handleMenuDismiss);
                document.addEventListener('keydown', handleEsc);
                return () => {
                    document.removeEventListener('mousedown', handleMenuDismiss);
                    document.removeEventListener('keydown', handleEsc);
                };
            }, [showFlowLayoutMenu, showActionsMenu]);

            useEffect(() => {
                if (view !== 'flowchart' && showFlowLayoutMenu) {
                    setShowFlowLayoutMenu(false);
                }
                setShowActionsMenu(false);
            }, [view, showFlowLayoutMenu]);

            // Print interceptor hook
            useEffect(() => {
                const handleBeforePrint = () => flushSync(() => setIsPrinting(true));
                const handleAfterPrint = () => flushSync(() => setIsPrinting(false));
                
                // Broad browser support for print event intercepts
                const mql = window.matchMedia('print');
                const mqlListener = (e) => flushSync(() => setIsPrinting(e.matches));

                window.addEventListener('beforeprint', handleBeforePrint);
                window.addEventListener('afterprint', handleAfterPrint);
                if (mql.addEventListener) mql.addEventListener('change', mqlListener);
                else mql.addListener(mqlListener);

                return () => {
                    window.removeEventListener('beforeprint', handleBeforePrint);
                    window.removeEventListener('afterprint', handleAfterPrint);
                    if (mql.removeEventListener) mql.removeEventListener('change', mqlListener);
                    else mql.removeListener(mqlListener);
                };
            }, []);

            // Persistence + health status
            useEffect(() => {
                const syncOnline = () => {
                    const online = navigator.onLine;
                    setIsOnline(online);
                    setBootChecks(prev => ({ ...prev, cloudSyncUnavailable: !online }));
                    setSyncSummary(getSyncSummary());
                };
                window.addEventListener('online', syncOnline);
                window.addEventListener('offline', syncOnline);
                return () => {
                    window.removeEventListener('online', syncOnline);
                    window.removeEventListener('offline', syncOnline);
                };
            }, []);

            useEffect(() => {
                const initLocal = async () => {
                    const projects = await listWorkspaces();
                    setSavedProjects(projects);
                    const latestId = getLastWorkspaceId();
                    const latest = (latestId && await loadWorkspace(latestId)) || projects[0] || await getLatestWorkspace();
                    if (latest?.name) setProjectName(latest.name);
                    if (latest?.id) setCurrentWorkspaceId(latest.id);
                    recordAuditEvent('workspace_bootstrap', { hasLatestWorkspace: Boolean(latest?.id), savedWorkspaceCount: projects.length });
                    setSyncSummary(getSyncSummary());
                    setBootChecks({
                        offlineModeActive: 'ServiceWorker' in navigator,
                        cloudSyncUnavailable: !navigator.onLine
                    });
                };
                initLocal();
            }, []);

            const handleSaveWorkspace = async () => {
                if (!projectName.trim()) return false;
                setIsSaving(true);
                try {
                    const data = toWorkspaceSavePayload({
                        projectName,
                        nodes,
                        instrumentList,
                        flowNodes,
                        flowEdges,
                        flowPz,
                        treeScale,
                        printOrientation,
                        gridCols,
                        gridRows,
                        tracts,
                        contacts,
                        ownershipInterests,
                        contactLogs,
                        deskMaps,
                        activeDeskMapId,
                        appId,
                    });
                    const savedWorkspace = await saveWorkspace(data, currentWorkspaceId);
                    setCurrentWorkspaceId(savedWorkspace.id);
                    const projects = await listWorkspaces();
                    setSavedProjects(projects);
                    recordAuditEvent('workspace_saved', { workspaceId: savedWorkspace.id, workspaceName: data.name });
                    recordSyncOperation('upsert', 'workspace', savedWorkspace.id, { workspaceName: data.name });
                    setSyncSummary(getSyncSummary());
                    return true;
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSaving(false);
                }
                return false;
            };

            useEffect(() => {
                if (!workspaceLoaded || showHome) return;
                const timer = setTimeout(() => {
                    handleSaveWorkspace();
                }, 400);
                return () => clearTimeout(timer);
            }, [
                nodes, instrumentList, flowNodes, flowEdges, flowPz, treeScale, printOrientation,
                gridCols, gridRows, tracts, contacts, ownershipInterests, contactLogs,
                deskMaps, activeDeskMapId, projectName, workspaceLoaded, currentWorkspaceId, showHome
            ]);

            const handleLoadWorkspace = (p, closeModal = true) => {
                const hydrated = fromStoredWorkspace(p, {
                    makeId,
                    defaultRoot,
                    defaultViewport,
                    defaultFlowViewport,
                    normalizeFlowNodeGroups,
                });

                setNodes(hydrated.nodes);
                setInstrumentList(hydrated.instrumentList);
                setFlowNodes(hydrated.flowNodes);
                setFlowEdges(hydrated.flowEdges);
                setFlowPz(hydrated.flowPz);
                setTreeScale(hydrated.treeScale);
                setPrintOrientation(hydrated.printOrientation);
                setGridCols(hydrated.gridCols);
                setGridRows(hydrated.gridRows);
                setTracts(hydrated.tracts);
                setContacts(hydrated.contacts);
                setOwnershipInterests(hydrated.ownershipInterests);
                setContactLogs(hydrated.contactLogs);
                setSelectedContactId(hydrated.selectedContactId);
                setDeskMaps(hydrated.deskMaps);
                setActiveDeskMapId(hydrated.activeDeskMapId);
                setPz(hydrated.pz);
                setProjectName(hydrated.projectName);
                setCurrentWorkspaceId(hydrated.workspaceId);
                setWorkspaceLoaded(true);
                setShowHome(false);
                if (closeModal) setShowCloudModal(false);
                recordAuditEvent('workspace_loaded', { workspaceId: hydrated.workspaceId, workspaceName: hydrated.projectName });
            };
            
            const handleEnterNewWorkspace = async () => {
                const freshWorkspaceId = crypto.randomUUID ? crypto.randomUUID() : makeId();
                const freshNode = { ...defaultRoot };
                const freshDeskMap = {
                    id: makeId(),
                    name: 'Unit Tract 1',
                    code: 'TRACT-1',
                    tractId: null,
                    nodes: [{ ...freshNode }],
                    pz: { ...defaultViewport }
                };

                setNodes([{ ...freshNode }]);
                setDeskMaps([freshDeskMap]);
                setActiveDeskMapId(freshDeskMap.id);
                setPz({ ...defaultViewport });
                setFlowNodes([]);
                setFlowEdges([]);
                setFlowPz({ ...defaultFlowViewport });
                setTreeScale(1);
                setPrintOrientation('landscape');
                setGridCols(defaultFlowGrid.cols);
                setGridRows(defaultFlowGrid.rows);
                setTracts([]);
                setContacts([]);
                setOwnershipInterests([]);
                setContactLogs([]);
                setSelectedContactId(null);

                const initialPayload = {
                    name: 'My Workspace',
                    nodes: [{ ...freshNode }],
                    instrumentList,
                    flowNodes: [],
                    flowEdges: [],
                    flowPz: { ...defaultFlowViewport },
                    treeScale: 1,
                    printOrientation: 'landscape',
                    gridCols: 1,
                    gridRows: 1,
                    tracts: [],
                    contacts: [],
                    ownershipInterests: [],
                    contactLogs: [],
                    deskMaps: [{ ...freshDeskMap }],
                    activeDeskMapId: freshDeskMap.id,
                    updatedAt: Date.now(),
                    appId
                };

                try {
                    const saved = await saveWorkspace(initialPayload, freshWorkspaceId);
                    const projects = await listWorkspaces();
                    setSavedProjects(projects);
                    recordAuditEvent('workspace_created', { workspaceId: saved.id, workspaceName: saved.name || 'My Workspace' });
                    recordSyncOperation('insert', 'workspace', saved.id, { workspaceName: saved.name || 'My Workspace' });
                    setSyncSummary(getSyncSummary());
                } catch (e) {
                    console.error(e);
                    window.alert('Unable to create a new workspace in local storage. Please try again.');
                }

                setCurrentWorkspaceId(freshWorkspaceId);
                setProjectName('My Workspace');
                setWorkspaceLoaded(true);
                setShowHome(false);
            };

            const handleClearFlowchart = () => {
                if (!window.confirm('Clear all flowchart nodes, edges, and layout settings? This cannot be undone.')) return;
                setFlowNodes([]);
                setFlowEdges([]);
                setSelectedFlowNode(null);
                setConnectingStart(null);
                setFlowPz({ ...defaultFlowViewport });
                setTreeScale(1);
                setGridCols(defaultFlowGrid.cols);
                setGridRows(defaultFlowGrid.rows);
                setShowActionsMenu(false);
                recordAuditEvent('flowchart_cleared', { previousNodeCount: flowNodes.length, previousEdgeCount: flowEdges.length });
                recordSyncOperation('update', 'flowchart', currentWorkspaceId, { action: 'clear', previousNodeCount: flowNodes.length, previousEdgeCount: flowEdges.length });
                setSyncSummary(getSyncSummary());
            };

            const handleDocSelection = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    setForm(prev => ({ ...prev, docData: evt.target.result, docNo: file.name.split('.')[0] }));
                };
                reader.readAsDataURL(file);
                e.target.value = ''; 
            };

            const formatFraction = (num) => (isNaN(num) || num === null || num === undefined ? "0.00000000" : Number(num).toFixed(8));
            const formatConveyanceFraction = (node) => {
                if (!node || node.type !== 'conveyance' || node.conveyanceMode !== 'fraction') return '';
                const numerator = Number(node.numerator || 0);
                const denominator = Number(node.denominator || 0);
                if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return '';

                const basisLabel =
                    node.splitBasis === 'initial'
                        ? 'of predecessor grant'
                        : node.splitBasis === 'remaining'
                            ? 'of predecessor remaining'
                            : 'of whole tract';

                return `${numerator}/${denominator} ${basisLabel}`;
            };

            const FRACTION_EPSILON = 0.00000001;
            const clampFraction = (value) => {
                const numeric = Number(value || 0);
                if (!Number.isFinite(numeric)) return 0;
                if (numeric < 0 && numeric > -FRACTION_EPSILON) return 0;
                return Math.max(0, numeric);
            };

            const collectDescendantIds = (allNodes, rootId) => {
                const descendants = new Set();
                const queue = [rootId];
                while (queue.length) {
                    const currentId = queue.shift();
                    allNodes.forEach(node => {
                        if (node.parentId !== currentId || descendants.has(node.id)) return;
                        descendants.add(node.id);
                        queue.push(node.id);
                    });
                }
                return descendants;
            };

            const applyAttachConveyanceUpdate = (allNodes) => {
                const descendants = collectDescendantIds(allNodes, activeNode.id);
                if (attachParentId === activeNode.id || descendants.has(attachParentId)) return allNodes;

                const sourceRoot = allNodes.find(n => n.id === activeNode.id);
                if (!sourceRoot) return allNodes;

                const oldRootFraction = Math.max(sourceRoot.fraction || 0, FRACTION_EPSILON);
                const newRootFraction = clampFraction(calcShare);
                const scaleFactor = newRootFraction / oldRootFraction;

                return allNodes.map(n => {
                    if (n.id === attachParentId) {
                        return { ...n, fraction: clampFraction((n.fraction || 0) - newRootFraction) };
                    }
                    if (n.id === activeNode.id) {
                        return {
                            ...n,
                            ...form,
                            parentId: attachParentId,
                            type: 'conveyance',
                            fraction: newRootFraction,
                            initialFraction: newRootFraction
                        };
                    }
                    if (descendants.has(n.id)) {
                        return {
                            ...n,
                            fraction: clampFraction((n.fraction || 0) * scaleFactor),
                            initialFraction: clampFraction((n.initialFraction || 0) * scaleFactor)
                        };
                    }
                    return n;
                });
            };

            const calcShare = useMemo(() => {
                if (modalMode !== 'convey' && modalMode !== 'attach') return 0;
                const parentIdToUse = modalMode === 'attach' ? attachParentId : activeNode?.id;
                const parent = nodes.find(n => n.id === parentIdToUse);
                if (!parent) return 0;
                const ratio = (parseFloat(form.numerator || 0) / parseFloat(form.denominator || 1));
                if (form.conveyanceMode === 'all') return parent.fraction;
                if (form.conveyanceMode === 'fixed') return parseFloat(form.manualAmount || 0);
                if (form.conveyanceMode === 'fraction') {
                    let base = 1.0;
                    if (form.splitBasis === 'whole') base = 1.0;
                    else if (form.splitBasis === 'initial') base = parent.initialFraction ?? parent.fraction;
                    else if (form.splitBasis === 'remaining') base = parent.fraction;
                    return base * ratio;
                }
                return 0;
            }, [form, nodes, modalMode, activeNode, attachParentId]);

            // CRUD Actions
            const openEdit = (node) => {
                if (!instrumentList.includes(node.instrument)) setInstrumentList(prev => [...prev, node.instrument]);
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('edit'); setActiveNode(node);
                setForm({ ...node, conveyanceMode: 'fraction', splitBasis: 'initial', numerator: 1, denominator: 2, manualAmount: 0 });
                setShowModal(true);
            };

            const openConvey = (node) => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('convey'); setActiveNode(node);
                const today = new Date().toISOString().split('T')[0];
                setForm({
                    instrument: 'Warranty Deed', vol: '', page: '', docNo: '', fileDate: today, date: today, type: 'conveyance',
                    grantor: node.grantee, grantee: '', landDesc: node.landDesc, remarks: '',
                    conveyanceMode: lastMathProps.conveyanceMode, splitBasis: lastMathProps.splitBasis, numerator: lastMathProps.numerator, 
                    denominator: lastMathProps.denominator, manualAmount: lastMathProps.manualAmount, 
                    docData: '', isDeceased: false, obituary: '', graveyardLink: ''
                });
                setShowModal(true);
            };

            const openRelated = (node) => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('add_related'); setActiveNode(node);
                const today = new Date().toISOString().split('T')[0];
                setForm({
                    instrument: 'Affidavit of Heirship', vol: '', page: '', docNo: '', fileDate: today, date: today, type: 'related',
                    grantor: '', grantee: node.grantee, landDesc: node.landDesc, remarks: 'Related to branch',
                    conveyanceMode: 'fraction', splitBasis: 'initial', numerator: 1, denominator: 2, manualAmount: 0, docData: '',
                    isDeceased: false, obituary: '', graveyardLink: ''
                });
                setShowModal(true);
            };

            const openPrecede = (node) => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('precede'); setActiveNode(node);
                const today = new Date().toISOString().split('T')[0];
                setForm({
                    instrument: 'Warranty Deed', vol: '', page: '', docNo: '', fileDate: node.fileDate || today, date: node.date || today, type: 'conveyance',
                    grantor: '', grantee: node.grantor || '', landDesc: node.landDesc, remarks: 'Predecessor to ' + node.instrument,
                    estateType: node.estateType || 'Minerals', conveyanceMode: 'fraction', splitBasis: 'initial', numerator: 1, denominator: 2, manualAmount: 0, 
                    docData: '', isDeceased: false, obituary: '', graveyardLink: '',
                    initialFraction: node.initialFraction || node.fraction 
                });
                setShowModal(true);
            };

            const openNewChain = () => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('add_chain'); setActiveNode(null);
                const today = new Date().toISOString().split('T')[0];
                setForm({
                    instrument: 'Original Grant', vol: '', page: '', docNo: '', fileDate: today, date: today, type: 'conveyance',
                    grantor: 'Unknown / Sovereign', grantee: '', landDesc: '', remarks: 'Independent Title Chain', estateType: 'Minerals',
                    conveyanceMode: 'fraction', splitBasis: 'whole', numerator: 1, denominator: 1, manualAmount: 0, docData: '',
                    isDeceased: false, obituary: '', graveyardLink: '',
                    initialFraction: 1.0, fraction: 1.0
                });
                setShowModal(true);
            };

            const openAddUnlinked = () => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('add_unlinked'); setActiveNode(null);
                const today = new Date().toISOString().split('T')[0];
                setForm({
                    instrument: 'Warranty Deed', vol: '', page: '', docNo: '', fileDate: today, date: today, type: 'conveyance',
                    grantor: '', grantee: '', landDesc: '', remarks: 'Parked document pending research', estateType: 'Minerals',
                    conveyanceMode: 'fraction', splitBasis: 'initial', numerator: 1, denominator: 2, manualAmount: 0, docData: '',
                    isDeceased: false, obituary: '', graveyardLink: ''
                });
                setShowModal(true);
            };

            const openAttach = (node) => {
                setIsAddingInst(false); setShowGranteeList(false); setModalMode('attach'); setActiveNode(node);
                setAttachParentId(nodes.filter(n => n.id !== node.id && n.parentId !== 'unlinked')[0]?.id || 'root'); setAttachType('conveyance');
                setForm({ ...node, estateType: node.estateType || 'Minerals', conveyanceMode: lastMathProps.conveyanceMode, splitBasis: lastMathProps.splitBasis, numerator: lastMathProps.numerator, denominator: lastMathProps.denominator, manualAmount: lastMathProps.manualAmount });
                setShowModal(true);
            };

            const toggleDeceased = (node) => updateActiveDeskMapNodes(prev => prev.map(n => n.id === node.id ? { ...n, isDeceased: !n.isDeceased } : n));

            const handleCommit = () => {
                if (modalMode === 'convey' || modalMode === 'attach') {
                    setLastMathProps({ conveyanceMode: form.conveyanceMode, splitBasis: form.splitBasis, numerator: form.numerator, denominator: form.denominator, manualAmount: form.manualAmount });
                }
                if (modalMode === 'edit') updateActiveDeskMapNodes(prev => prev.map(n => n.id === activeNode.id ? { ...n, ...form } : n));
                else if (modalMode === 'convey') {
                    const newId = makeId();
                    const updatedNodes = nodes.map(n => n.id === activeNode.id ? { ...n, fraction: Math.max(0, n.fraction - calcShare) } : n);
                    updateActiveDeskMapNodes([...updatedNodes, { ...form, id: newId, type: 'conveyance', fraction: calcShare, initialFraction: calcShare, parentId: activeNode.id }]);
                } else if (modalMode === 'precede') {
                    const newId = makeId();
                    const updatedNodes = nodes.map(n => {
                        if (n.id === activeNode.id) return { ...n, parentId: newId };
                        if (activeNode.parentId && n.id === activeNode.parentId) {
                            return { ...n, fraction: n.fraction + activeNode.initialFraction - form.initialFraction };
                        }
                        return n;
                    });
                    const fractionRetained = form.initialFraction - activeNode.initialFraction;
                    updateActiveDeskMapNodes([...updatedNodes, { ...form, id: newId, type: 'conveyance', parentId: activeNode.parentId, initialFraction: form.initialFraction, fraction: Math.max(0, fractionRetained) }]);
                } else if (modalMode === 'add_chain') {
                    const newId = makeId();
                    updateActiveDeskMapNodes(prev => [...prev, { ...form, id: newId, type: 'conveyance', parentId: null }]);
                } else if (modalMode === 'add_related') {
                    const newId = makeId();
                    updateActiveDeskMapNodes(prev => [...prev, { ...form, id: newId, type: 'related', fraction: 0, initialFraction: 0, parentId: activeNode.id }]);
                } else if (modalMode === 'add_unlinked') {
                    const newId = makeId();
                    updateActiveDeskMapNodes(prev => [...prev, { ...form, id: newId, type: 'conveyance', fraction: 0, initialFraction: 0, parentId: 'unlinked' }]);
                } else if (modalMode === 'attach') {
                    if (attachType === 'conveyance') {
                        const descendants = collectDescendantIds(nodes, activeNode.id);
                        if (attachParentId === activeNode.id || descendants.has(attachParentId)) {
                            window.alert('Cannot attach a record to itself or one of its descendants.');
                            return;
                        }
                        updateActiveDeskMapNodes(prev => applyAttachConveyanceUpdate(prev));
                    } else {
                        updateActiveDeskMapNodes(prev => prev.map(n => n.id === activeNode.id ? { ...form, parentId: attachParentId, type: 'related', fraction: 0, initialFraction: 0 } : n));
                    }
                }
                setShowModal(false);
            };

            const requestDeleteRecord = (node) => {
                setConfirmAction({
                    title: 'Delete Title Record',
                    message: `Are you sure you want to permanently delete "${node.instrument}" to ${node.grantee}? Any attached child branches will be safely moved to the Runsheet Parking Lot.`,
                    actionText: 'Delete Record',
                    onConfirm: () => {
                        updateActiveDeskMapNodes(prev => prev.map(x => {
                            if (x.id === node.id) return null;
                            if (x.parentId === node.id) return { ...x, parentId: 'unlinked', remarks: (x.remarks ? x.remarks + ' ' : '') + '[Orphaned from deleted parent]' };
                            return x;
                        }).filter(Boolean));
                    }
                });
            };

            const escapeCSV = (val) => {
                if (val === null || val === undefined) return '""';
                return `"${String(val).replace(/"/g, '""')}"`;
            };

            const exportCSV = () => {
                const headers = ["Documents Hyperlinked", "Instrument", "Order by Date", "Image Path", "Vol", "Page", "Inst No.", "File Date", "Inst Date", "Grantor / Assignor", "Grantee / Assignee", "Land Desc.", "Remarks", "INTERNAL_REMAINING_FRACTION", "INTERNAL_INITIAL_FRACTION", "INTERNAL_ID", "INTERNAL_PID", "INTERNAL_DOC", "INTERNAL_TYPE", "INTERNAL_DECEASED", "INTERNAL_OBITUARY", "INTERNAL_GRAVEYARD_LINK", "INTERNAL_TRACTS", "INTERNAL_CONTACTS", "INTERNAL_INTERESTS", "INTERNAL_CONTACT_LOGS", "INTERNAL_DESKMAPS", "INTERNAL_ACTIVE_DESKMAP_ID"];
                const rows = (nodes.length ? nodes : [{
                    instrument: '', vol: '', page: '', docNo: '', fileDate: '', date: '', grantor: '', grantee: '', landDesc: '', remarks: '',
                    fraction: 0, initialFraction: 0, id: makeId(), parentId: 'NULL', docData: '', type: 'conveyance', isDeceased: false, obituary: '', graveyardLink: ''
                }]).map((n, i) => [
                    i + 1, n.instrument, i + 1, `TORS_Documents\\${n.docNo}.pdf`, n.vol, n.page, n.docNo,
                    n.fileDate, n.date, n.grantor, n.grantee, n.landDesc, n.remarks,
                    n.fraction, n.initialFraction || n.fraction, n.id, n.parentId || "NULL", n.docData || "", n.type || 'conveyance',
                    n.isDeceased ? 'true' : 'false', n.obituary || '', n.graveyardLink || '',
                    i === 0 ? JSON.stringify(tracts) : '',
                    i === 0 ? JSON.stringify(contacts) : '',
                    i === 0 ? JSON.stringify(ownershipInterests) : '',
                    i === 0 ? JSON.stringify(contactLogs) : '',
                    i === 0 ? JSON.stringify(deskMaps) : '',
                    i === 0 ? activeDeskMapId : ''
                ]);
                const content = "\uFEFF" + headers.join(",") + "\n" + rows.map(r => r.map(escapeCSV).join(",")).join("\n");
                const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `LANDroid_Data_Save_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
            };

            const exportToRunsheet = () => {
                const csvHeader = `Documents Hyperlinked to TORS_Documents Folder,Instrument,Order by Date,Image Path,Vol,Page,"Instrument No.\nSan Jacinto",File Date,Inst./Eff. Date,Assignor / Lessor,Assignee / Lessee,Land Desc.,Remarks`;
                const sortedNodes = [...nodes].sort((a,b) => new Date(a.date) - new Date(b.date));
                const rows = sortedNodes.map((n, i) => [
                    "", escapeCSV(n.instrument), "", "", escapeCSV(n.vol), escapeCSV(n.page), escapeCSV(n.docNo),
                    escapeCSV(n.fileDate), escapeCSV(n.date), escapeCSV(n.grantor), escapeCSV(n.grantee), escapeCSV(n.landDesc), escapeCSV(n.remarks)
                ]);
                const content = "\uFEFF" + csvHeader + "\n" + rows.map(r => r.join(",")).join("\n");
                const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `Runsheet_Export_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
            };

            const chooseImportMode = () => {
                const choice = window.prompt(
                    [
                        'Choose CSV import mode:',
                        '1 = Replace current project',
                        '2 = Merge into active desk map',
                        '3 = Create new desk map from CSV',
                        '',
                        'Enter 1, 2, or 3 (Cancel to abort).'
                    ].join('\n')
                );
                if (choice === null) return null;
                const normalized = String(choice).trim().toLowerCase();
                if (normalized === '1' || normalized === 'replace') return 'replace';
                if (normalized === '2' || normalized === 'merge') return 'merge';
                if (normalized === '3' || normalized === 'new') return 'new_map';
                window.alert('Import cancelled: invalid choice. Please enter 1, 2, or 3.');
                return null;
            };

            const importCSV = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const importMode = chooseImportMode();
                if (!importMode) {
                    e.target.value = '';
                    return;
                }
                Papa.parse(file, {
                    header: true, skipEmptyLines: true,
                    complete: (results) => {
                        const parseJsonField = (row, field) => {
                            const raw = row[field];
                            if (!raw) return [];
                            try {
                                return JSON.parse(raw);
                            } catch {
                                try {
                                    return JSON.parse(String(raw).replace(/""/g, '"'));
                                } catch {
                                    return [];
                                }
                            }
                        };
                        const findHeader = (row, patterns) => {
                            const keys = Object.keys(row);
                            for (let pattern of patterns) {
                                const match = keys.find(k => pattern.test(k));
                                if (match) return row[match].trim();
                            }
                            return "";
                        };
                        const parsedRows = results.data.map(row => {
                            const isInternal = !!row['INTERNAL_ID'];
                            return {
                                originalId: row['INTERNAL_ID'] || null,
                                instrument: findHeader(row, [/^Instrument$/i, /^Instrument \(/i, /Instrument/i]),
                                vol: findHeader(row, [/^Vol/i]),
                                page: findHeader(row, [/^Page/i]),
                                docNo: findHeader(row, [/Inst[\s\S]*No/i, /Doc[\s\S]*No/i]),
                                fileDate: findHeader(row, [/File[\s\S]*Date/i]),
                                date: findHeader(row, [/Inst[\s\S]*Eff/i, /Inst[\s\S]*Date/i, /Effective[\s\S]*Date/i, /^Date$/i]),
                                grantor: findHeader(row, [/Grantor/i, /Assignor/i, /Lessor/i]),
                                grantee: findHeader(row, [/Grantee/i, /Assignee/i, /Lessee/i, /Subject/i]),
                                landDesc: findHeader(row, [/Land[\s\S]*Desc/i, /Description/i]),
                                remarks: findHeader(row, [/Remark/i, /Note/i]),
                                fraction: isInternal ? parseFloat(row['INTERNAL_REMAINING_FRACTION'] || 0) : 0,
                                initialFraction: isInternal ? parseFloat(row['INTERNAL_INITIAL_FRACTION'] || 0) : 0,
                                parentId: isInternal ? (row['INTERNAL_PID'] === "NULL" ? null : row['INTERNAL_PID']) : 'unlinked', 
                                docData: row['INTERNAL_DOC'] ? row['INTERNAL_DOC'].replace(/(^"|"$)/g, '') : "",
                                type: row['INTERNAL_TYPE'] || 'conveyance',
                                isDeceased: row['INTERNAL_DECEASED'] === 'true',
                                obituary: row['INTERNAL_OBITUARY'] ? row['INTERNAL_OBITUARY'].replace(/(^"|"$)/g, '') : "",
                                graveyardLink: row['INTERNAL_GRAVEYARD_LINK'] ? row['INTERNAL_GRAVEYARD_LINK'].replace(/(^"|"$)/g, '') : ""
                            };
                        });
                        const existingIds = new Set([
                            ...nodes.map(n => n.id),
                            ...deskMaps.flatMap(map => (map.nodes || []).map(n => n.id))
                        ]);
                        const usedIds = new Set(existingIds);
                        const idRemap = {};
                        const newNodes = parsedRows.map(node => {
                            const sourceId = (node.originalId || '').trim();
                            let nextId = sourceId && !usedIds.has(sourceId) ? sourceId : makeId();
                            while (usedIds.has(nextId)) nextId = makeId();
                            usedIds.add(nextId);
                            if (sourceId) idRemap[sourceId] = nextId;
                            return { ...node, id: nextId };
                        }).map(node => {
                            const rawParentId = node.parentId;
                            let parentId = rawParentId;
                            if (typeof rawParentId === 'string' && rawParentId && rawParentId !== 'unlinked') {
                                parentId = idRemap[rawParentId] || (usedIds.has(rawParentId) ? rawParentId : 'unlinked');
                            }
                            const cleanedParent = parentId === 'NULL' ? null : parentId;
                            const { originalId, ...rest } = node;
                            return { ...rest, parentId: cleanedParent };
                        });
                        if (newNodes.length) {
                            const newInsts = [...new Set(newNodes.map(n => n.instrument).filter(Boolean))];
                            setInstrumentList(prev => [...new Set([...prev, ...newInsts])]);

                            const firstRow = results.data[0] || {};
                            if (importMode === 'replace') {
                                setNodes(newNodes);
                                setTracts(parseJsonField(firstRow, 'INTERNAL_TRACTS'));
                                const importedContacts = parseJsonField(firstRow, 'INTERNAL_CONTACTS');
                                setContacts(importedContacts);
                                setOwnershipInterests(parseJsonField(firstRow, 'INTERNAL_INTERESTS'));
                                setContactLogs(parseJsonField(firstRow, 'INTERNAL_CONTACT_LOGS'));
                                const importedDeskMaps = parseJsonField(firstRow, 'INTERNAL_DESKMAPS');
                                const importedActiveDeskMapId = firstRow['INTERNAL_ACTIVE_DESKMAP_ID'] || '';
                                if (importedDeskMaps.length) {
                                    setDeskMaps(importedDeskMaps);
                                    const nextDeskMapId = importedDeskMaps.some(map => map.id === importedActiveDeskMapId) ? importedActiveDeskMapId : importedDeskMaps[0].id;
                                    setActiveDeskMapId(nextDeskMapId);
                                    const activeMap = importedDeskMaps.find(map => map.id === nextDeskMapId) || importedDeskMaps[0];
                                    setNodes(activeMap.nodes || newNodes);
                                    setPz(activeMap.pz || { ...defaultViewport });
                                } else {
                                    const fallback = createDeskMap();
                                    fallback.nodes = newNodes;
                                    setDeskMaps([fallback]);
                                    setActiveDeskMapId(fallback.id);
                                    setPz({ ...defaultViewport });
                                }
                                setSelectedContactId((importedContacts[0] && importedContacts[0].id) || null);
                            } else if (importMode === 'merge') {
                                setDeskMaps(prev => prev.map(map => {
                                    if (map.id !== activeDeskMapId) return map;
                                    return { ...map, nodes: [...(map.nodes || []), ...newNodes] };
                                }));
                                setNodes(prev => [...prev, ...newNodes]);
                            } else {
                                const mapNumber = deskMaps.length + 1;
                                const newDeskMap = createDeskMap({ name: `Imported Map ${mapNumber}`, code: `IMPORTED-${mapNumber}` });
                                newDeskMap.nodes = newNodes;
                                setDeskMaps(prev => [...prev, newDeskMap]);
                                setActiveDeskMapId(newDeskMap.id);
                                setPz({ ...defaultViewport });
                            }

                            const modeLabel = importMode === 'replace' ? 'replace' : importMode === 'merge' ? 'merge' : 'new map';
                            const mapSummary = importMode === 'replace'
                                ? 'Maps updated: project desk maps replaced from import (or rebuilt fallback map).'
                                : importMode === 'merge'
                                    ? 'Maps updated: active desk map merged; other maps preserved.'
                                    : 'Maps created: 1 new desk map from CSV; existing maps preserved.';
                            window.alert(`Import complete.\nRecords imported: ${newNodes.length}\nMode: ${modeLabel}\n${mapSummary}`);
                        }
                    },
                    error: (error) => console.error("Error parsing CSV:", error)
                });
                e.target.value = ''; 
            };

            const addTract = () => {
                if (!tractForm.code.trim()) return;
                const tractId = makeId();
                const tractCode = tractForm.code.trim();
                const tractName = tractForm.name.trim();
                setTracts(prev => [...prev, {
                    id: tractId,
                    code: tractCode,
                    name: tractName,
                    acres: parseFloat(tractForm.acres) || 0,
                    mapId: tractForm.mapId.trim()
                }]);
                const newDeskMap = createDeskMap({ name: tractName || tractCode, code: tractCode, tractId });
                setDeskMaps(prev => [...prev, newDeskMap]);
                setActiveDeskMapId(newDeskMap.id);
                setTractForm({ code: '', name: '', acres: '', mapId: '' });
            };

            const addContact = () => {
                if (!contactForm.name.trim()) return;
                const newContact = {
                    id: makeId(),
                    name: contactForm.name.trim(),
                    role: contactForm.role.trim(),
                    phone: contactForm.phone.trim(),
                    email: contactForm.email.trim()
                };
                setContacts(prev => [...prev, newContact]);
                setSelectedContactId(newContact.id);
                setContactForm({ name: '', role: '', phone: '', email: '' });
            };

            const addInterest = () => {
                if (!interestForm.contactId || !interestForm.tractId || !interestForm.interestValue) return;
                const parsedInterest = parseFloat(interestForm.interestValue);
                if (Number.isNaN(parsedInterest) || parsedInterest < 0 || parsedInterest > 1) {
                    window.alert('Interest must be a decimal between 0 and 1.');
                    return;
                }
                setOwnershipInterests(prev => [...prev, {
                    id: makeId(),
                    contactId: interestForm.contactId,
                    tractId: interestForm.tractId,
                    interestType: interestForm.interestType,
                    interestValue: parsedInterest,
                    status: interestForm.status
                }]);
                setInterestForm(prev => ({ ...prev, interestValue: '' }));
            };

            const addContactLog = () => {
                if (!logForm.contactId || !logForm.outcome.trim()) return;
                setContactLogs(prev => [...prev, {
                    id: makeId(),
                    contactId: logForm.contactId,
                    tractId: logForm.tractId || null,
                    method: logForm.method,
                    outcome: logForm.outcome.trim(),
                    nextFollowupAt: logForm.nextFollowupAt || '',
                    notes: logForm.notes.trim(),
                    contactAt: new Date().toISOString()
                }]);
                setLogForm(prev => ({ ...prev, outcome: '', notes: '', nextFollowupAt: '' }));
            };

            const removeTract = (tractId) => {
                setTracts(prev => prev.filter(t => t.id !== tractId));
                setOwnershipInterests(prev => prev.filter(i => i.tractId !== tractId));
                setContactLogs(prev => prev.filter(l => l.tractId !== tractId));
                setDeskMaps(prev => {
                    const filtered = prev.filter(map => map.tractId !== tractId);
                    if (filtered.length) return filtered;
                    return [createDeskMap()];
                });
            };

            const removeContact = (contactId) => {
                setContacts(prev => prev.filter(c => c.id !== contactId));
                setOwnershipInterests(prev => prev.filter(i => i.contactId !== contactId));
                setContactLogs(prev => prev.filter(l => l.contactId !== contactId));
                setSelectedContactId(prev => prev === contactId ? null : prev);
            };

            const removeInterest = (interestId) => {
                setOwnershipInterests(prev => prev.filter(i => i.id !== interestId));
            };

            const removeContactLog = (logId) => {
                setContactLogs(prev => prev.filter(l => l.id !== logId));
            };

            // Regular Desk Map Build/Render
            const buildTree = (pId = null) => {
                const children = nodes.filter(n => n.parentId === pId && n.type !== 'related');
                return children.map(n => ({ ...n, children: buildTree(n.id) }));
            };
            const tree = useMemo(() => buildTree(), [nodes]);

            const handlePointerDown = (e) => {
                if (e.button !== 0 || e.target.closest('button') || e.target.closest('.treenode-body')) return;
                isDragging.current = true; dragStart.current = { x: e.clientX - pz.x, y: e.clientY - pz.y }; e.currentTarget.setPointerCapture(e.pointerId);
            };
            const handlePointerMove = (e) => {
                if (!isDragging.current) return;
                setPz(prev => ({ ...prev, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
            };
            const handlePointerUp = (e) => {
                isDragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId);
            };
            const handleWheel = (e) => {
                e.preventDefault();
                const scaleAdjust = e.deltaY * -0.001;
                const rect = e.currentTarget.getBoundingClientRect();
                const pointerX = e.clientX - rect.left;
                const pointerY = e.clientY - rect.top;

                setPz(prev => {
                    const nextScale = Math.min(Math.max(0.1, prev.scale + scaleAdjust), 5);
                    if (nextScale === prev.scale) return prev;

                    const worldX = (pointerX - prev.x) / prev.scale;
                    const worldY = (pointerY - prev.y) / prev.scale;

                    return {
                        ...prev,
                        scale: nextScale,
                        x: pointerX - worldX * nextScale,
                        y: pointerY - worldY * nextScale
                    };
                });
            };

            const countTreeDescendants = (node) => {
                if (!node?.children?.length) return 0;
                return node.children.reduce((sum, child) => sum + 1 + countTreeDescendants(child), 0);
            };

            const toggleTreeBranchCollapse = (nodeId) => {
                updateActiveDeskMapNodes(prevNodes => prevNodes.map(node => (
                    node.id === nodeId ? { ...node, isCollapsed: !node.isCollapsed } : node
                )));
            };

            // PERFORMANCE: Extracted to a standard render function to prevent destructive unmounting/remounting on every frame
            const renderTreeNode = (n) => {
                const relatedDocs = nodes.filter(x => x.parentId === n.id && x.type === 'related');
                const isDeceased = n.isDeceased;
                const conveyanceFractionLabel = formatConveyanceFraction(n);
                const hasChildren = n.children.length > 0;
                const isCollapsed = Boolean(n.isCollapsed);
                const hiddenDescendantCount = isCollapsed ? countTreeDescendants(n) : 0;
                return (
                    <div key={n.id} className="flex flex-col items-center relative animate-fade-in treenode">
                        <div className="z-10 group relative treenode-body">
                            <div 
                                onClick={() => openEdit(n)} 
                                className={`p-4 border min-w-[260px] max-w-[300px] cursor-pointer transition-all duration-300 relative ${
                                    isDeceased ? 'bg-teastain border-sepia text-sepia ink-shadow' : 'bg-parchment border-ink text-ink ink-shadow ink-shadow-hover'
                                }`}
                            >
                                <div className={`flex justify-between items-start mb-2 border-b pb-2 ${isDeceased ? 'border-sepia/20' : 'border-ink/20'}`}>
                                    <span className="font-serif text-xs font-bold uppercase tracking-widest text-sepia">{n.instrument}</span>
                                    <div className="flex gap-1 items-center">
                                        {hasChildren && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTreeBranchCollapse(n.id);
                                                }}
                                                title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
                                                className={`px-1.5 py-0.5 text-xs font-bold border rounded-sm transition-colors ${
                                                    isDeceased ? 'border-sepia/50 hover:bg-sepia/20' : 'border-ink/40 hover:bg-ink/10'
                                                }`}
                                            >
                                                {isCollapsed ? '+' : '−'}
                                            </button>
                                        )}
                                        {n.docData && (
                                            <button onClick={(e) => { e.stopPropagation(); setViewerData(n.docData); }} title="View Vault Document" className={`p-1 border border-transparent hover:border-current rounded-sm transition-colors text-stamp`}>
                                                <Icon name="Eye" size={16} />
                                            </button>
                                        )}
                                        {!n.docData && n.hasDoc && <span className={`p-1 ${isDeceased ? 'text-sepia/40' : 'text-sepia/30'}`} title="Document in Cloud Vault"><Icon name="Cloud" size={16} /></span>}
                                        <button onClick={(e) => { e.stopPropagation(); toggleDeceased(n); }} title="Toggle Graveyard Protocol" className={`p-1 border border-transparent hover:border-current rounded-sm transition-colors ${isDeceased ? 'text-sepia/80' : 'text-sepia/30 hover:text-sepia'}`}>
                                            <Icon name="Tombstone" size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5">Grantee / Assignee</div>
                                    <div className="font-display font-bold text-base leading-tight">{n.grantee}</div>
                                </div>
                                <div className="mb-3">
                                    <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5">Grantor / Assignor</div>
                                    <div className="font-mono text-xs truncate opacity-80">{n.grantor}</div>
                                </div>
                                {conveyanceFractionLabel && (
                                    <div className="mb-3">
                                        <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5">Conveyance</div>
                                        <div className="font-mono text-xs">{conveyanceFractionLabel}</div>
                                    </div>
                                )}
                                <div className={`flex flex-col border-t pt-2 font-mono ${isDeceased ? 'border-sepia/20' : 'border-ink/20'}`}>
                                    <div className="flex justify-between items-end mb-1 ">
                                        <span className="text-[10px] uppercase tracking-widest opacity-60">Grant</span>
                                        <span className="text-sm font-bold text-sepia">{formatFraction(n.initialFraction || n.fraction)}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className={`text-[10px] uppercase tracking-widest italic ${n.fraction < 0.00000001 ? 'text-stamp font-bold' : 'opacity-60'}`}>Rem</span>
                                        <span className={`text-xs italic ${n.fraction < 0.00000001 ? 'text-stamp font-bold' : ''}`}>{formatFraction(n.fraction)}</span>
                                    </div>
                                </div>
                                
                                {/* CAUSE OF DEATH TILE BLOCK */}
                                {isDeceased && n.obituary && (
                                    <div className="mt-3 pt-3 border-t border-sepia/20 text-left w-full">
                                        <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-1">Death Notes</div>
                                        <div className="text-sm text-fountain whitespace-pre-wrap font-handwriting leading-relaxed">
                                            {n.obituary}
                                        </div>
                                    </div>
                                )}
                                
                                {/* ATTACHED / RELATED DOCS TILE BLOCK */}
                                {relatedDocs.length > 0 && (
                                    <div className={`mt-3 pt-3 border-t text-left w-full flex flex-col gap-1.5 ${isDeceased ? 'border-sepia/20' : 'border-ink/20'}`}>
                                        <div className={`text-[9px] uppercase tracking-widest mb-0.5 ${isDeceased ? 'text-sepia/60' : 'opacity-60'}`}>Attached Records</div>
                                        {relatedDocs.map(doc => (
                                            <div 
                                                key={doc.id} 
                                                onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                                                className={`flex items-center justify-between p-1.5 border transition-colors cursor-pointer ${
                                                    isDeceased 
                                                        ? 'border-sepia/40 bg-teastain hover:bg-sepia/10 text-sepia shadow-[2px_2px_0px_#704214]' 
                                                        : 'border-ink bg-parchment hover:bg-teastain text-ink shadow-[2px_2px_0px_#1A1A1B]'
                                                }`}
                                                title="Click to edit details"
                                            >
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Icon name="Paperclip" size={10} className="min-w-[10px] opacity-70" />
                                                    <span className="font-serif font-bold text-[10px] uppercase tracking-wider truncate">{doc.instrument}</span>
                                                </div>
                                                {doc.docData && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setViewerData(doc.docData); }} 
                                                        className="p-1 hover:text-stamp transition-colors ml-2"
                                                        title="View Vault PDF"
                                                    >
                                                        <Icon name="Eye" size={12}/>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {isCollapsed && hiddenDescendantCount > 0 && (
                                    <div className={`mt-3 inline-flex items-center px-2 py-1 border rounded-sm text-[10px] font-mono uppercase tracking-wider ${
                                        isDeceased ? 'border-sepia/40 bg-sepia/10 text-sepia' : 'border-ink/40 bg-ink/5 text-ink/80'
                                    }`}>
                                        +{hiddenDescendantCount} descendants
                                    </div>
                                )}
                            </div>
                            
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                {n.parentId === null && nodes.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); openAttach(n); }} className="bg-sepia text-parchment border border-sepia rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-sepia/80 shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-all"><Icon name="Link" size={12} /> ATTACH</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); openPrecede(n); }} className="bg-ink text-parchment border border-parchment rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-ink/80 shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-transform"><Icon name="ArrowUp" size={12} /> PRECEDE</button>
                                <button onClick={(e) => { e.stopPropagation(); openRelated(n); }} className="bg-parchment text-ink border border-ink/40 rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-teastain shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-transform"><Icon name="Paperclip" size={12} /> + DOC</button>
                                <button onClick={(e) => { e.stopPropagation(); openConvey(n); }} className="bg-teastain text-sepia border border-sepia/60 rounded-sm px-4 py-1 text-[10px] font-bold hover:bg-parchment hover:border-sepia shadow-lg flex items-center gap-1 hover:-translate-y-0.5 transition-all"><Icon name="Convey" size={12} /> CONVEY</button>
                                {nodes.length > 1 && <button onClick={(e) => { e.stopPropagation(); requestDeleteRecord(n); }} className="bg-parchment text-stamp border border-stamp/60 rounded-sm p-1.5 text-[10px] font-bold hover:bg-teastain hover:border-stamp shadow-lg flex items-center justify-center hover:-translate-y-0.5 transition-all"><Icon name="Trash" size={14} /></button>}
                            </div>
                        </div>
                        {hasChildren && !isCollapsed && (
                            <div className="flex relative justify-center pt-8">
                                {n.children.map((c, i) => (
                                    <div key={c.id} className="relative flex flex-col items-center px-4">
                                        <div className="absolute top-0 left-1/2 w-[1px] h-8 bg-ink -translate-x-1/2 -mt-8 z-0"></div>
                                        {n.children.length > 1 && <div className={`absolute -top-8 h-[1px] bg-ink z-0 ${i === 0 ? 'left-1/2 right-0' : i === n.children.length - 1 ? 'left-0 right-1/2' : 'left-0 right-0'}`}></div>}
                                        {renderTreeNode(c)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            };


            /* =========================================================================================
                                     FLOW CHART ENGINE (TOP-DOWN LAYOUT)
            ========================================================================================= */

            const createTreeGroupId = () => `tg_${makeId()}`;
            const resolveTreeGroupId = (node) => node?.treeGroupId || (node?.id ? `tg_${node.id}` : createTreeGroupId());
            const normalizeFlowNodeGroups = (inputNodes = []) => inputNodes.map(node => ({ ...node, treeGroupId: resolveTreeGroupId(node) }));
            const mergeFlowNodeGroups = (inputNodes, firstNodeId, secondNodeId) => {
                const firstNode = inputNodes.find(n => n.id === firstNodeId);
                const secondNode = inputNodes.find(n => n.id === secondNodeId);
                if (!firstNode || !secondNode) return inputNodes;

                const firstGroup = resolveTreeGroupId(firstNode);
                const secondGroup = resolveTreeGroupId(secondNode);
                if (firstGroup === secondGroup) return inputNodes;

                const unifiedGroup = [firstGroup, secondGroup].sort()[0];
                return inputNodes.map(node => {
                    const nodeGroup = resolveTreeGroupId(node);
                    if (nodeGroup !== firstGroup && nodeGroup !== secondGroup) return { ...node, treeGroupId: nodeGroup };
                    return { ...node, treeGroupId: unifiedGroup };
                });
            };

            const buildFlowLayoutFromNodes = (sourceNodes, idPrefix = '', xShift = 0, treeGroupId = '') => {
                const safePrefix = idPrefix ? `${idPrefix}-` : '';
                const normalNodes = sourceNodes.filter(n => n.type !== 'related');
                if (!normalNodes.length) return { nodes: [], edges: [], width: 0 };
                const newFlowNodes = [];
                const newFlowEdges = [];
                const nodePositions = {};
                let leafX = 0;
                const levelYSpacing = 280;
                const startY = 60;

                const childrenOf = (id) => normalNodes.filter(c => c.parentId === id);
                const layoutNode = (nId, depth) => {
                    const children = childrenOf(nId);
                    if (children.length === 0) {
                        nodePositions[nId] = { x: leafX, y: startY + (depth * levelYSpacing) };
                        leafX += 340;
                        return nodePositions[nId].x;
                    }
                    const childXs = children.map(c => {
                        newFlowEdges.push({ id: `e-${safePrefix}${nId}-${safePrefix}${c.id}`, source: `${safePrefix}${nId}`, target: `${safePrefix}${c.id}` });
                        return layoutNode(c.id, depth + 1);
                    });
                    const myX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
                    nodePositions[nId] = { x: myX, y: startY + (depth * levelYSpacing) };
                    return myX;
                };

                const roots = normalNodes.filter(n => n.parentId === null);
                roots.forEach(root => { layoutNode(root.id, 0); leafX += 200; });

                const minX = Math.min(...Object.values(nodePositions).map(p => p.x));
                const maxX = Math.max(...Object.values(nodePositions).map(p => p.x + 280));
                const width = Math.max(280, maxX - minX);

                normalNodes.forEach(n => {
                    const pos = nodePositions[n.id] || { x: 0, y: 0 };
                    newFlowNodes.push({
                        id: `${safePrefix}${n.id}`,
                        treeGroupId: treeGroupId || safePrefix || 'default-tree',
                        x: (pos.x - minX) + xShift,
                        y: pos.y,
                        type: 'template',
                        color: n.isDeceased ? 'bg-teastain text-sepia border-sepia' : 'bg-parchment text-ink border-ink',
                        data: {
                            title: n.instrument,
                            grantee: n.grantee,
                            grantor: n.grantor,
                            fraction: formatFraction(n.fraction),
                            details: `${n.date} ${n.vol && n.page ? `• Vol ${n.vol}/Pg ${n.page}` : ''}`
                        }
                    });
                });
                return { nodes: newFlowNodes, edges: newFlowEdges, width };
            };

            const getFlowSelectedDeskMaps = () => {
                if (flowDeskMapFilter === 'all') return deskMaps;
                if (flowDeskMapFilter === 'active') return deskMaps.filter(map => map.id === activeDeskMapId);
                return deskMaps.filter(map => map.id === flowDeskMapFilter);
            };

            const fitFlowToView = (targetNodes) => {
                const scopeNodes = targetNodes || flowNodes;
                if (!scopeNodes.length) return;
                const containerRect = flowCanvasRef.current?.getBoundingClientRect();
                const viewportW = Math.max(700, (containerRect?.width || window.innerWidth) - 80);
                const viewportH = Math.max(500, (containerRect?.height || window.innerHeight) - 110);
                const minX = Math.min(...scopeNodes.map(n => n.x));
                const maxX = Math.max(...scopeNodes.map(n => n.x + (n.type === 'template' ? 280 : (n.data.width || 280))));
                const minY = Math.min(...scopeNodes.map(n => n.y));
                const maxY = Math.max(...scopeNodes.map(n => n.y + (n.type === 'template' ? 150 : 80)));
                const contentW = Math.max(300, maxX - minX);
                const contentH = Math.max(200, maxY - minY);
                const fitScale = Math.min(viewportW / contentW, viewportH / contentH, 1);
                setTreeScale(fitScale);
                const centerX = minX + contentW / 2;
                const centerY = minY + contentH / 2;
                const targetX = (viewportW / 2) - (centerX * fitScale);
                const targetY = (viewportH / 2) - (centerY * fitScale);
                setFlowPz({ x: Math.min(600, Math.max(-6000, targetX)), y: Math.min(400, Math.max(-6000, targetY)), scale: fitScale });
            };

            const importToFlowchart = (append = false) => {
                const selectedMaps = getFlowSelectedDeskMaps();
                if (!selectedMaps.length) {
                    window.alert('No DeskMap selected for Flow Chart import.');
                    return;
                }
                if (!append && flowNodes.length > 0 && !window.confirm("This will overwrite your current Flow Chart canvas. Proceed?")) return;

                let xCursor = append && flowNodes.length ? (Math.max(...flowNodes.map(n => n.x + 300)) + 200) : 0;
                const built = selectedMaps.map((map, i) => {
                    const result = buildFlowLayoutFromNodes(map.nodes || [], `${map.id}-${i}-${makeId()}`, xCursor, map.id);
                    xCursor += result.width + 220;
                    return result;
                });

                const importedNodes = built.flatMap(b => b.nodes);
                const importedEdges = built.flatMap(b => b.edges);
                const nextNodes = append ? [...flowNodes, ...importedNodes] : importedNodes;
                const nextEdges = append ? [...flowEdges, ...importedEdges] : importedEdges;
                setFlowNodes(nextNodes);
                setFlowEdges(nextEdges);
                recordAuditEvent('flowchart_imported', { append, deskMapCount: selectedMaps.length, nodeCount: nextNodes.length, edgeCount: nextEdges.length });
                recordSyncOperation('update', 'flowchart', currentWorkspaceId, { action: 'import', append, nodeCount: nextNodes.length, edgeCount: nextEdges.length });
                setSyncSummary(getSyncSummary());

                if (nextNodes.length) fitFlowToView(nextNodes);
            };

            const handlePrintFlowchart = () => {
                flushSync(() => setIsPrinting(true));
                setTimeout(() => {
                    window.print();
                    setTimeout(() => setIsPrinting(false), 150);
                }, 50);
            };

            const handleDeleteWorkspace = async (workspaceId) => {
                if (!workspaceId) return;
                if (!window.confirm('Delete this saved workspace permanently?')) return;
                await deleteWorkspace(workspaceId);
                recordAuditEvent('workspace_deleted', { workspaceId });
                recordSyncOperation('delete', 'workspace', workspaceId);
                setSyncSummary(getSyncSummary());
                const projects = await listWorkspaces();
                setSavedProjects(projects);
                if (currentWorkspaceId === workspaceId) {
                    setCurrentWorkspaceId(null);
                    setProjectName('My Workspace');
                    setWorkspaceLoaded(false);
                    setShowCloudModal(false);
                    setShowHome(true);
                }
            };

            const handleDeleteAllWorkspaces = async () => {
                if (!savedProjects.length) return;
                if (!window.confirm('Delete ALL saved workspaces? This cannot be undone.')) return;
                await deleteAllWorkspaces();
                recordAuditEvent('workspace_deleted_all', { deletedCount: savedProjects.length });
                recordSyncOperation('delete_all', 'workspace', null, { deletedCount: savedProjects.length });
                setSyncSummary(getSyncSummary());
                setSavedProjects([]);
                setCurrentWorkspaceId(null);
                setProjectName('My Workspace');
                setWorkspaceLoaded(false);
                setShowCloudModal(false);
                setShowHome(true);
            };

            const handleReturnHome = async () => {
                try {
                    await handleSaveWorkspace();
                    const projects = await listWorkspaces();
                    setSavedProjects(projects);
                } catch (e) {
                    console.error(e);
                } finally {
                    setView('chart');
                    setShowHome(true);
                }
            };

            const addFlowNode = (type) => {
                const id = `fn_${makeId()}`;
                const scalerRect = document.getElementById('tree-scaler')?.getBoundingClientRect();
                const canvasRect = flowCanvasRef.current?.getBoundingClientRect();
                const anchorX = canvasRect ? canvasRect.left + (canvasRect.width / 2) : (window.innerWidth / 2);
                const anchorY = canvasRect ? canvasRect.top + (canvasRect.height / 2) : (window.innerHeight / 2);
                const newNode = {
                    id,
                    x: ((anchorX - (scalerRect?.left || 0)) / (flowPz.scale * treeScale)) - 140,
                    y: ((anchorY - (scalerRect?.top || 0)) / (flowPz.scale * treeScale)) - 100,
                    type,
                    treeGroupId: selectedFlowNode
                        ? resolveTreeGroupId(flowNodes.find(n => n.id === selectedFlowNode))
                        : createTreeGroupId(),
                    color: 'bg-parchment text-ink border-ink',
                    data: type === 'template' ? {
                        title: 'Instrument', grantee: 'Grantee Name', grantor: 'Grantor Name', fraction: '1.00000000', details: 'Date • Vol/Page'
                    } : { text: 'Double click to edit text...', width: 280 }
                };
                setFlowNodes([...flowNodes, newNode]);
                setSelectedFlowNode(id);
                setFlowForm(newNode.data);
                setFlowTool('select');
                setShowFlowEditModal(true);
            };

            const handleFlowPointerDown = (e) => {
                if (e.target.closest('.flow-node') || e.target.closest('.flow-ui')) return; 
                if (flowTool === 'pan') {
                    isDragging.current = true; dragStart.current = { x: e.clientX - flowPz.x, y: e.clientY - flowPz.y };
                    e.currentTarget.setPointerCapture(e.pointerId); setSelectedFlowNode(null);
                } else if (flowTool === 'move-tree') {
                    isDragging.current = true;
                    moveTreeStartPos.current = { x: e.clientX, y: e.clientY };
                    initialTreeNodes.current = flowNodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
                    moveTreeGroupId.current = null;
                    e.currentTarget.setPointerCapture(e.pointerId); setSelectedFlowNode(null);
                }
            };
            
            const handleFlowPointerMove = (e) => {
                if (flowTool === 'connect' && connectingStart) {
                    const rect = document.getElementById('tree-scaler').getBoundingClientRect();
                    setMousePos({ x: (e.clientX - rect.left) / (flowPz.scale * treeScale), y: (e.clientY - rect.top) / (flowPz.scale * treeScale) });
                }
                if (!isDragging.current) return;
                
                if (flowTool === 'pan') {
                    setFlowPz(prev => ({ ...prev, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
                } else if (flowTool === 'move-tree' && moveTreeStartPos.current && initialTreeNodes.current) {
                    const dx = (e.clientX - moveTreeStartPos.current.x) / (flowPz.scale * treeScale);
                    const dy = (e.clientY - moveTreeStartPos.current.y) / (flowPz.scale * treeScale);
                    const initialNodes = initialTreeNodes.current; // Capture ref to prevent null error in async state updater
                    const targetGroup = moveTreeGroupId.current;
                    setFlowNodes(prev => prev.map(n => {
                        if (targetGroup && resolveTreeGroupId(n) !== targetGroup) return n;
                        const orig = initialNodes.find(o => o.id === n.id);
                        return orig ? { ...n, x: orig.x + dx, y: orig.y + dy } : n;
                    }));
                }
            };
            
            const handleFlowPointerUp = (e) => {
                isDragging.current = false;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                if (connectingStart) setConnectingStart(null); 
                moveTreeStartPos.current = null;
                initialTreeNodes.current = null;
                moveTreeGroupId.current = null;
            };
            
            const handleFlowWheel = (e) => {
                if (e.ctrlKey || e.metaKey || flowTool === 'pan') { 
                    e.preventDefault();
                    const scaleAdjust = e.deltaY * -0.002;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pointerX = e.clientX - rect.left;
                    const pointerY = e.clientY - rect.top;

                    setFlowPz(prev => {
                        const nextScale = Math.min(Math.max(0.1, prev.scale + scaleAdjust), 3);
                        if (nextScale === prev.scale) return prev;

                        const worldX = (pointerX - prev.x) / prev.scale;
                        const worldY = (pointerY - prev.y) / prev.scale;

                        return {
                            ...prev,
                            scale: nextScale,
                            x: pointerX - worldX * nextScale,
                            y: pointerY - worldY * nextScale
                        };
                    });
                }
            };

            const handleNodePointerDown = (e, node) => {
                e.stopPropagation();
                if (flowTool === 'connect') {
                    setConnectingStart(node.id);
                    // For template we use center, for note box we approximate width center
                    const wOffset = node.type === 'template' ? 140 : (node.data.width ? node.data.width/2 : 140);
                    setMousePos({ x: node.x + wOffset, y: node.y + 100 }); 
                } else if (flowTool === 'select') {
                    setSelectedFlowNode(node.id);
                    flowDraggingNode.current = { id: node.id, origX: node.x, origY: node.y };
                    flowDragStart.current = { x: e.clientX, y: e.clientY };
                    e.currentTarget.setPointerCapture(e.pointerId);
                } else if (flowTool === 'move-tree') {
                    isDragging.current = true;
                    moveTreeStartPos.current = { x: e.clientX, y: e.clientY };
                    initialTreeNodes.current = flowNodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
                    moveTreeGroupId.current = resolveTreeGroupId(node);
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSelectedFlowNode(null);
                }
            };
            
            const handleNodePointerMove = (e) => {
                if (flowTool === 'select' && flowDraggingNode.current) {
                    e.stopPropagation();
                    const dx = (e.clientX - flowDragStart.current.x) / (flowPz.scale * treeScale);
                    const dy = (e.clientY - flowDragStart.current.y) / (flowPz.scale * treeScale);
                    const draggedNode = flowDraggingNode.current; // Capture ref to prevent null error in async state updater
                    
                    setFlowNodes(nodes => nodes.map(n => n.id === draggedNode.id 
                        ? { ...n, x: draggedNode.origX + dx, y: draggedNode.origY + dy } 
                        : n));
                } else if (flowTool === 'move-tree' && isDragging.current && moveTreeStartPos.current && initialTreeNodes.current) {
                    e.stopPropagation();
                    const dx = (e.clientX - moveTreeStartPos.current.x) / (flowPz.scale * treeScale);
                    const dy = (e.clientY - moveTreeStartPos.current.y) / (flowPz.scale * treeScale);
                    const initialNodes = initialTreeNodes.current; // Capture ref to prevent null error in async state updater
                    const targetGroup = moveTreeGroupId.current;
                    
                    setFlowNodes(prev => prev.map(n => {
                        if (targetGroup && resolveTreeGroupId(n) !== targetGroup) return n;
                        const orig = initialNodes.find(o => o.id === n.id);
                        return orig ? { ...n, x: orig.x + dx, y: orig.y + dy } : n;
                    }));
                }
            };
            
            const handleNodePointerUp = (e, targetNode) => {
                e.stopPropagation();
                if (flowDraggingNode.current) {
                    flowDraggingNode.current = null;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }
                if (flowTool === 'connect' && connectingStart && connectingStart !== targetNode.id) {
                    const edgeExists = flowEdges.find(ed => ed.source === connectingStart && ed.target === targetNode.id);
                    if (!edgeExists) {
                        setFlowEdges([...flowEdges, { id: `e-${connectingStart}-${targetNode.id}`, source: connectingStart, target: targetNode.id }]);
                        setFlowNodes(prev => mergeFlowNodeGroups(prev, connectingStart, targetNode.id));
                    }
                    setConnectingStart(null);
                }
                if (flowTool === 'move-tree') {
                    isDragging.current = false;
                    moveTreeStartPos.current = null;
                    initialTreeNodes.current = null;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }
            };

            const changeNodeColor = (colorClass) => {
                if (!selectedFlowNode) return;
                setFlowNodes(nodes => nodes.map(n => n.id === selectedFlowNode ? { ...n, color: colorClass } : n));
            };

            const deleteSelectedFlowElement = () => {
                if (!selectedFlowNode) return;
                setFlowNodes(nodes => nodes.filter(n => n.id !== selectedFlowNode));
                setFlowEdges(edges => edges.filter(e => e.source !== selectedFlowNode && e.target !== selectedFlowNode));
                setSelectedFlowNode(null);
            };

            const commitFlowEdit = () => {
                setFlowNodes(nodes => nodes.map(n => n.id === selectedFlowNode ? { ...n, data: flowForm } : n));
                setShowFlowEditModal(false);
            };

            const drawEdge = (x1, y1, x2, y2) => {
                const yMid = (y1 + y2) / 2;
                return `M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`;
            };

            // Abstract out the tree rendering so we can use it on the Interactive screen AND the Print slices
            const renderTree = (isInteractive) => (
                <>
                    {/* Edge Layer (SVG) */}
                    <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-10">
                        <defs>
                            <marker id="arrowhead-ink" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#1A1A1B" /></marker>
                        </defs>
                        {flowEdges.map(edge => {
                            const source = flowNodes.find(n => n.id === edge.source);
                            const target = flowNodes.find(n => n.id === edge.target);
                            if (!source || !target) return null;
                            const x1 = source.x + (source.type === 'template' ? 140 : (source.data.width ? source.data.width/2 : 140)); 
                            const y1 = source.y + (source.type === 'template' ? 140 : 50);
                            const x2 = target.x + (target.type === 'template' ? 140 : (target.data.width ? target.data.width/2 : 140)); 
                            const y2 = target.y;
                            return (
                                <g key={edge.id} className={isInteractive ? "cursor-pointer pointer-events-auto" : "pointer-events-none"} onClick={(e) => { if(isInteractive) { e.stopPropagation(); if (flowTool === 'select') deleteSelectedFlowElement(edge.id); }}}>
                                    <path d={drawEdge(x1, y1, x2, y2)} fill="none" stroke="#1A1A1B" strokeWidth="2" markerEnd="url(#arrowhead-ink)" />
                                </g>
                            );
                        })}
                        {/* Temp connecting line */}
                        {isInteractive && flowTool === 'connect' && connectingStart && flowNodes.find(n => n.id === connectingStart) && (
                            <path 
                                d={drawEdge(
                                    flowNodes.find(n => n.id === connectingStart).x + (flowNodes.find(n => n.id === connectingStart).type === 'template' ? 140 : (flowNodes.find(n => n.id === connectingStart).data.width/2 || 140)), 
                                    flowNodes.find(n => n.id === connectingStart).y + 100, 
                                    mousePos.x, mousePos.y
                                )} 
                                fill="none" stroke="#1A1A1B" strokeWidth="2" strokeDasharray="5,5" 
                            />
                        )}
                    </svg>

                    {/* HTML Node Layer */}
                    <div className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none">
                        {flowNodes.map(n => (
                            <div 
                                key={n.id}
                                id={isInteractive ? n.id : undefined}
                                className={`flow-node absolute transition-shadow bg-parchment ${
                                    isInteractive ? 'pointer-events-auto ' + (flowTool === 'select' ? 'cursor-grab active:cursor-grabbing' : flowTool === 'move-tree' ? 'cursor-move' : flowTool === 'connect' ? 'cursor-crosshair' : '') : ''
                                } ${isInteractive && selectedFlowNode === n.id ? 'ring-4 ring-sepia/50 ring-offset-4 ring-offset-transparent' : ''}`}
                                style={{ transform: `translate(${n.x}px, ${n.y}px)` }}
                                onPointerDown={isInteractive ? (e) => handleNodePointerDown(e, n) : undefined}
                                onPointerMove={isInteractive ? handleNodePointerMove : undefined}
                                onPointerUp={isInteractive ? (e) => handleNodePointerUp(e, n) : undefined}
                                onPointerCancel={isInteractive ? (e) => handleNodePointerUp(e, n) : undefined}
                                onDoubleClick={isInteractive ? (e) => {
                                    e.stopPropagation();
                                    if (flowTool === 'select') {
                                        setSelectedFlowNode(n.id); setFlowForm(n.data); setShowFlowEditModal(true);
                                    }
                                } : undefined}
                            >
                                {n.type === 'template' ? (
                                    <div className={`w-[280px] p-4 border ${isInteractive ? 'ink-shadow' : 'border-ink'} ${n.color}`}>
                                        <div className="border-b border-current/20 pb-2 mb-2">
                                            <div className="font-serif text-xs font-bold uppercase tracking-widest text-sepia">{n.data.title}</div>
                                            <div className="font-mono text-[10px] opacity-60 mt-1">{n.data.details}</div>
                                        </div>
                                        <div className="mb-2">
                                            <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5">Grantee / Assignee</div>
                                            <div className="font-display font-bold text-base leading-tight">{n.data.grantee}</div>
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5">Grantor / Assignor</div>
                                            <div className="font-mono text-xs truncate opacity-80">{n.data.grantor}</div>
                                        </div>
                                        <div className="border-t border-current/20 pt-2 flex justify-between items-end">
                                            <span className="text-[10px] uppercase tracking-widest opacity-60 font-mono">Interest</span>
                                            <span className="font-mono font-bold text-sm">{n.data.fraction}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        className={`p-5 border ${isInteractive ? 'ink-shadow' : 'border-ink'} ${n.color}`}
                                        style={{ width: n.data.width || 280 }}
                                    >
                                        <div className="font-serif text-sm whitespace-pre-wrap break-words">{n.data.text}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            );

            const viewActions = {
                chart: [
                    { key: 'new-tree', label: 'New Tree', icon: 'Plus', onClick: openNewChain, title: 'Start a completely separate independent lineage tree' },
                    { key: 'add-loose-record', label: 'Add Loose Record', icon: 'Plus', onClick: openAddUnlinked, title: 'Add a document to the Parking Lot' },
                    { key: 'import-csv', label: 'Import CSV', icon: 'Upload', onClick: () => fileInput.current?.click(), title: 'Upload Data' },
                    { key: 'save-data', label: 'Save Data', icon: 'Download', onClick: exportCSV, title: 'Save Internal Data' }
                ],
                master: [
                    { key: 'export-runsheet', label: 'Export Runsheet', icon: 'FileText', onClick: exportToRunsheet, title: 'Generate Chronological Runsheet' },
                    { key: 'toggle-conveyance-filter', label: showOnlyConveyances ? 'Show All Records' : 'Show Conveyances Only', icon: 'List', onClick: () => setShowOnlyConveyances(prev => !prev), title: 'Toggle runsheet filter' },
                    { key: 'save-data', label: 'Save Data', icon: 'Download', onClick: exportCSV, title: 'Save Internal Data' },
                    { key: 'import-csv', label: 'Import CSV', icon: 'Upload', onClick: () => fileInput.current?.click(), title: 'Upload Data' }
                ],
                flowchart: [
                    { key: 'import-flowchart', label: 'Import Tree → Flowchart', icon: 'Upload', onClick: () => importToFlowchart(false), title: 'Replace flowchart with transformed tree' },
                    { key: 'append-flowchart', label: 'Append Tree → Flowchart', icon: 'Plus', onClick: () => importToFlowchart(true), title: 'Append transformed tree to flowchart' },
                    { key: 'print-flowchart', label: 'Print Flowchart', icon: 'Printer', onClick: handlePrintFlowchart, title: 'Print flowchart layout' },
                    { key: 'clear-flowchart', label: 'Clear Flowchart', icon: 'Trash', onClick: handleClearFlowchart, title: 'Remove all flowchart nodes/edges and reset layout defaults', destructive: true }
                ],
                research: [
                    { key: 'save-data', label: 'Save Data', icon: 'Download', onClick: exportCSV, title: 'Save Internal Data' },
                    { key: 'import-csv', label: 'Import CSV', icon: 'Upload', onClick: () => fileInput.current?.click(), title: 'Upload Data' }
                ]
            };
            const currentActions = viewActions[view] || [];
            const quickActions = [
                { key: 'save-workspace', label: 'Save', icon: 'Download', onClick: handleSaveWorkspace, title: 'Save workspace locally' },
                { key: 'save-home', label: 'Home', icon: 'ArrowUp', onClick: handleReturnHome, title: 'Save and return to startup page' }
            ];

            return (
                <>
                {/* Dynamically assign the physical print page size based on orientation toggle */}
                <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: letter ${printOrientation}; margin: 0; } }` }} />
                
                {showHome ? (
                    <div className="h-screen w-screen p-4 sm:p-8 font-mono text-ink flex items-center justify-center">
                        <div className="w-full max-w-3xl bg-parchment/95 border border-ink/30 ink-shadow-lg rounded-2xl p-6 sm:p-8">
                            <h1 className="font-serif text-3xl font-black tracking-tight">LANDroid</h1>
                            <p className="mt-2 text-sm text-ink/80">Choose a saved workspace or start a new one.</p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <button onClick={handleEnterNewWorkspace} className="px-4 py-2 text-xs font-bold rounded border border-ink bg-ink text-parchment">Start New Workspace</button>
                                <button onClick={() => fileInput.current.click()} className="px-4 py-2 text-xs font-bold rounded border border-ink/30 bg-teastain">Import CSV</button>
                            </div>
                            <input type="file" ref={fileInput} onChange={(e) => { importCSV(e); setWorkspaceLoaded(true); setShowHome(false); }} className="hidden" accept=".csv" />
                            <div className="mt-6">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-xs font-bold uppercase tracking-widest text-sepia">Saved Workspaces</h2>
                                    <button aria-label="Delete All Workspaces" onClick={handleDeleteAllWorkspaces} className="px-2 py-1 text-[10px] font-bold border border-stamp/60 text-stamp hover:bg-stamp hover:text-parchment rounded transition-colors">Delete All</button>
                                </div>
                                <div className="mt-2 max-h-[45vh] overflow-auto border border-ink/20 rounded-lg bg-parchment">
                                    {savedProjects.length === 0 ? (
                                        <div className="p-4 text-sm text-ink/60">No saved workspaces yet.</div>
                                    ) : (
                                        savedProjects.map((p) => (
                                            <div key={p.id} className="w-full border-b last:border-b-0 border-ink/10 flex items-center gap-2 p-2 hover:bg-teastain/40">
                                                <button onClick={() => handleLoadWorkspace(p, false)} className="flex-1 text-left p-1">
                                                    <div className="font-bold text-sm">{p.name || 'Untitled Workspace'}</div>
                                                    <div className="text-[11px] text-ink/60">Updated {new Date(p.updatedAt || Date.now()).toLocaleString()}</div>
                                                </button>
                                                <button aria-label={`Delete Workspace ${p.name || p.id}`} onClick={() => handleDeleteWorkspace(p.id)} className="px-2 py-1 text-[10px] font-bold border border-stamp/60 text-stamp hover:bg-stamp hover:text-parchment transition-colors rounded" title="Delete workspace">
                                                    Delete
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                <div className="h-screen w-screen overflow-hidden flex flex-col relative font-mono text-ink px-3 sm:px-5 py-3 sm:py-4 gap-3">
                    
                    {/* The Surveyors Desk Header - HIDDEN ON PRINT */}
                    <header className="cyber-header-bg z-40 relative px-4 sm:px-6 py-4 flex justify-between items-start no-print rounded-2xl ink-shadow">
                        <div className="flex flex-col gap-3">
                            <div>
                                <h1 className="font-serif text-2xl font-black tracking-tight flex items-baseline gap-2">
                                    LANDroid 
                                    <span className="text-sm font-normal text-sepia opacity-80 font-mono not-italic">&gt; by Abstract Mapping</span>
                                </h1>
                            </div>
                            
                            <div className="group">
                                <div className={`rubber-stamp bg-parchment shadow-sm ${totalRemaining > 1.00000001 ? 'error animate-vibrate' : ''}`}>
                                    <span className="opacity-80 text-xs mr-2">Master Total:</span>
                                    <span className="text-lg">{formatFraction(totalRemaining)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 pt-1">
                            <div className="flex flex-col items-end gap-1 text-[11px] font-bold">
                                <span className="px-2 py-1 rounded border border-ink/30 bg-teastain/60">Offline mode active: {bootChecks.offlineModeActive ? 'Yes' : 'No'}</span>
                                <span className="px-2 py-1 rounded border border-ink/30 bg-teastain/60">Cloud sync unavailable: {bootChecks.cloudSyncUnavailable ? 'Yes' : 'No'}</span>
                                <span className="px-2 py-1 rounded border border-ink/30 bg-teastain/60">Sync status: {syncSummary.status === 'pending' ? `Pending (${syncSummary.pendingCount})` : 'Synced'}</span>
                            </div>
                            {/* View Navigation Group */}
                            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                                <div className="inline-flex items-center bg-teastain/40 rounded-xl border border-ink/20 p-1.5 shadow-sm">
                                    <button onClick={() => setView('chart')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === 'chart' ? 'bg-ink text-parchment shadow-sm' : 'text-ink/60 hover:text-ink hover:bg-parchment/50'}`}>
                                        <Icon name="Chart" size={14} /> <span className="hidden md:inline">Desk Map</span><span className="md:hidden">Map</span>
                                    </button>
                                    <button onClick={() => setView('master')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === 'master' ? 'bg-ink text-parchment shadow-sm' : 'text-ink/60 hover:text-ink hover:bg-parchment/50'}`}>
                                        <Icon name="Clock" size={14} /> <span className="hidden md:inline">Runsheet</span><span className="md:hidden">Runsheet</span>
                                    </button>
                                    
                                    <div className="hidden sm:block w-px h-5 bg-ink/20 mx-1"></div>
                                    
                                    <button onClick={() => setView('flowchart')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === 'flowchart' ? 'bg-sepia text-parchment shadow-sm' : 'text-sepia/80 hover:text-sepia hover:bg-parchment/50'}`}>
                                        <Icon name="Flowchart" size={14} /> <span className="hidden md:inline">Flow Chart</span><span className="md:hidden">Flow</span>
                                    </button>
                                    <button onClick={() => setView('research')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === 'research' ? 'bg-fountain text-parchment shadow-sm' : 'text-fountain/80 hover:text-fountain hover:bg-parchment/50'}`}>
                                        <Icon name="Users" size={14} /> <span className="hidden md:inline">Research Hub</span><span className="md:hidden">Hub</span>
                                    </button>
                                </div>
                            </div>

                            {/* Data Actions Group */}
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 bg-parchment/70 rounded-xl border border-ink/20 p-1.5 shadow-sm">
                                {quickActions.map((action) => (
                                    <button key={action.key} onClick={action.onClick} className="px-3 py-1.5 text-xs font-bold text-ink/85 hover:text-ink hover:bg-parchment rounded transition-all flex items-center gap-2" title={action.title}>
                                        <Icon name={action.icon} size={14} /> <span>{action.label}</span>
                                    </button>
                                ))}

                                <span className="px-2 py-1 text-[10px] uppercase tracking-widest rounded border border-ink/20 bg-parchment/60 text-ink/60">
                                    {isSaving ? 'Saving…' : 'AutoSave On'}
                                </span>

                                <div className="relative" ref={actionsMenuRef}>
                                    <button
                                        onClick={() => setShowActionsMenu(prev => !prev)}
                                        className="px-3 py-1.5 text-xs font-bold text-fountain/90 hover:text-fountain hover:bg-fountain/10 rounded transition-all flex items-center gap-2"
                                        aria-haspopup="menu"
                                        aria-expanded={showActionsMenu}
                                        title="Open view-specific actions"
                                    >
                                        <Icon name="List" size={14} /> <span>Actions ▾</span>
                                    </button>

                                    {showActionsMenu && (
                                        <div className="absolute right-0 mt-1 min-w-[220px] z-50 rounded-lg border border-ink/20 bg-parchment shadow-lg p-1">
                                            {currentActions.length > 0 ? currentActions.map((action) => (
                                                <button
                                                    key={action.key}
                                                    onClick={() => {
                                                        action.onClick();
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs font-bold rounded transition-all flex items-center gap-2 ${action.destructive ? 'text-stamp hover:text-stamp hover:bg-stamp/10' : 'text-ink/80 hover:text-ink hover:bg-teastain/50'}`}
                                                    title={action.title}
                                                    role="menuitem"
                                                >
                                                    <Icon name={action.icon} size={13} />
                                                    <span>{action.label}</span>
                                                </button>
                                            )) : (
                                                <div className="px-3 py-2 text-xs text-ink/60">No actions available for this view.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInput} onChange={importCSV} className="hidden" accept=".csv" />
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 w-full flex flex-col relative overflow-hidden rounded-2xl border border-ink/20 bg-parchment/30 backdrop-blur-[1px]">
                        
                        {/* -------------------- RUNSHEET / UNIFIED LEDGER VIEW -------------------- */}
                        {view === 'master' && (
                            <div className="flex-1 overflow-auto parchment-grid p-4 sm:p-6 animate-fade-in no-print rounded-2xl">
                                <div className="max-w-[1800px] mx-auto bg-parchment/95 border border-ink/30 ink-shadow-lg overflow-hidden flex flex-col rounded-2xl">
                                    <div className="p-4 bg-gradient-to-r from-ink via-ink to-sepia text-parchment border-b border-ink/70 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon name="Clock" size={16} />
                                            <span className="text-xs font-bold uppercase tracking-widest font-serif">Master Runsheet Log</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] uppercase tracking-widest text-parchment/80 font-bold">DeskMap:</span>
                                                <select value={runsheetDeskMapFilter} onChange={e => setRunsheetDeskMapFilter(e.target.value)} className="bg-parchment text-ink border border-parchment/30 text-[10px] px-2 py-1 rounded">
                                                    <option value="active">Active DeskMap</option>
                                                    <option value="all">All DeskMaps</option>
                                                    {deskMaps.map(map => <option key={`rs-${map.id}`} value={map.id}>{map.code} {map.name ? `- ${map.name}` : ''}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex bg-ink border border-parchment/30 rounded-sm p-0.5">
                                                <button onClick={() => setShowOnlyConveyances(false)} className={`px-3 py-1 text-[9px] font-bold uppercase transition-all rounded-sm ${!showOnlyConveyances ? 'bg-parchment text-ink shadow-sm' : 'text-parchment/60 hover:text-parchment'}`}>All Records</button>
                                                <button onClick={() => setShowOnlyConveyances(true)} className={`px-3 py-1 text-[9px] font-bold uppercase transition-all rounded-sm ${showOnlyConveyances ? 'bg-parchment text-ink shadow-sm' : 'text-parchment/60 hover:text-parchment'}`}>Conveyances Only</button>
                                            </div>
                                            <div className="text-[10px] font-mono opacity-60 hidden sm:flex items-center">
                                                {filteredSortedNodes.filter(n => n.parentId === 'unlinked').length > 0 && !showOnlyConveyances && (
                                                    <span className="text-parchment bg-stamp/80 px-2 py-0.5 rounded-sm mr-3 font-bold inline-flex items-center gap-1">
                                                        {filteredSortedNodes.filter(n => n.parentId === 'unlinked').length} Loose Record(s) pending link
                                                    </span>
                                                )}
                                                Sorted by Effective Date
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-teastain/90 border-b border-ink/40 text-[9px] text-ink font-bold uppercase tracking-widest sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2 border-r border-ink/20">Instrument</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">Inst Date</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">File Date</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">Vol/Pg</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">Grantor / Assignor</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">Grantee / Subject</th>
                                                    <th className="px-4 py-2 border-r border-ink/20">Land Desc.</th>
                                                    {showOnlyConveyances && <th className="px-4 py-2 border-r border-ink/20 text-sepia">Retained Share</th>}
                                                    <th className="px-4 py-2 border-r border-ink/20">Remarks</th>
                                                    <th className="px-4 py-2 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-ink/20">
                                                {filteredSortedNodes.map(n => (
                                                    <tr key={n.id} className={`group cursor-pointer transition-colors ${n.parentId === 'unlinked' ? 'bg-[#E6DFCC]/50' : n.type === 'related' ? 'bg-teastain/80' : 'bg-parchment hover:bg-teastain'}`} onClick={() => openEdit(n)}>
                                                        <td className="px-4 py-1.5 font-serif font-bold text-[11px] border-r border-ink/20">
                                                            {n.instrument}
                                                            {n.parentId === 'unlinked' && <span className="ml-2 px-1.5 py-0.5 bg-sepia/10 text-sepia text-[8px] uppercase tracking-wider rounded border border-sepia/30 font-mono inline-block">Unlinked</span>}
                                                            {n.type === 'related' && <span className="ml-2 px-1.5 py-0.5 bg-ink/5 text-ink/60 text-[8px] uppercase tracking-wider rounded border border-ink/20 font-mono inline-block">Related</span>}
                                                            {n.isDeceased && <Icon name="Tombstone" size={10} className="inline ml-2 opacity-60 text-sepia" />}
                                                        </td>
                                                        <td className="px-4 py-1.5 text-[11px] font-mono border-r border-ink/20">{n.date}</td>
                                                        <td className="px-4 py-1.5 font-mono text-[11px] border-r border-ink/20">{n.fileDate || '-'}</td>
                                                        <td className="px-4 py-1.5 font-mono text-[11px] border-r border-ink/20">{n.vol && n.page ? `${n.vol}/${n.page}` : "-"}</td>
                                                        <td className="px-4 py-1.5 text-[11px] truncate max-w-[150px] border-r border-ink/20 opacity-80">{n.grantor || '-'}</td>
                                                        <td className="px-4 py-1.5 font-serif font-bold text-[11px] truncate max-w-[200px] border-r border-ink/20">{n.grantee}</td>
                                                        <td className="px-4 py-1.5 text-[11px] truncate max-w-[150px] border-r border-ink/20">{n.landDesc || '-'}</td>
                                                        {showOnlyConveyances && <td className="px-4 py-1.5 font-bold font-mono text-[11px] border-r border-ink/20">{formatFraction(n.fraction)}</td>}
                                                        <td className="px-4 py-1.5 text-[10px] truncate max-w-[150px] italic border-r border-ink/20 opacity-60">{n.remarks}</td>
                                                        <td className="px-4 py-1.5 text-right flex items-center justify-end gap-1">
                                                            {(n.parentId === 'unlinked' || n.parentId === null) && nodes.length > 1 && (
                                                                <button onClick={(e) => { e.stopPropagation(); openAttach(n); }} className="px-2 py-1 bg-sepia text-parchment border border-sepia hover:bg-sepia/80 rounded-sm transition-colors text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ink-shadow">
                                                                    <Icon name="Link" size={10}/> Attach
                                                                </button>
                                                            )}
                                                            {n.docData && (
                                                                <button onClick={(e) => { e.stopPropagation(); setViewerData(n.docData); }} className="p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors text-stamp" title="View PDF">
                                                                    <Icon name="Eye" size={14}/>
                                                                </button>
                                                            )}
                                                            {n.parentId !== 'unlinked' && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); openPrecede(n); }} className="p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors" title="Insert Predecessor Record">
                                                                        <Icon name="ArrowUp" size={14}/>
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); openRelated(n); }} className="p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors" title="Attach Related Doc">
                                                                        <Icon name="Paperclip" size={14}/>
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); openConvey(n); }} className="p-1 border border-transparent hover:border-sepia text-sepia rounded-sm transition-colors" title="Convey from this row">
                                                                        <Icon name="Convey" size={14}/>
                                                                    </button>
                                                                </>
                                                            )}
                                                            {nodes.length > 1 && (
                                                                <button onClick={(e) => { e.stopPropagation(); requestDeleteRecord(n); }} className="p-1 border border-transparent hover:border-stamp/50 text-stamp rounded-sm transition-colors">
                                                                    <Icon name="Trash" size={14}/>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {view === 'research' && (
                            <div className="flex-1 overflow-auto parchment-grid p-4 sm:p-6 animate-fade-in no-print rounded-2xl">
                                <div className="max-w-[1800px] mx-auto bg-parchment/95 border border-ink/30 ink-shadow-lg overflow-hidden flex flex-col rounded-2xl">
                                    <div className="p-4 bg-gradient-to-r from-fountain via-ink to-sepia text-parchment border-b border-ink/70 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Icon name="Users" size={16} />
                                            <span className="text-xs font-bold uppercase tracking-widest font-serif">Research Hub</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                                            <span>{contacts.length} Contacts</span>
                                            <span>•</span>
                                            <span>{contactLogs.length} Log Entries</span>
                                        </div>
                                    </div>

                                    <div className="p-3 border-b border-ink/20 bg-teastain/60 flex gap-2 flex-wrap">
                                        {[
                                            { key: 'contacts', label: 'Contacts (Placeholder)', icon: 'Users' }
                                        ].map(tab => (
                                            <button key={tab.key} onClick={() => setResearchTab(tab.key)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${researchTab === tab.key ? 'bg-ink text-parchment shadow-sm' : 'text-ink/70 hover:text-ink hover:bg-parchment/50'}`}>
                                                <Icon name={tab.icon} size={13} /> {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {false && (
                                        <div className="p-4 grid md:grid-cols-2 gap-4">
                                            <div className="border border-ink/20 rounded-xl p-3 bg-parchment">
                                                <h3 className="text-xs font-bold uppercase tracking-widest mb-3">Add Tract</h3>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <input className="border border-ink p-2" placeholder="Tract Code" value={tractForm.code} onChange={e => setTractForm({ ...tractForm, code: e.target.value })} />
                                                    <input className="border border-ink p-2" placeholder="Display Name" value={tractForm.name} onChange={e => setTractForm({ ...tractForm, name: e.target.value })} />
                                                    <input className="border border-ink p-2" placeholder="Gross Acres" type="number" value={tractForm.acres} onChange={e => setTractForm({ ...tractForm, acres: e.target.value })} />
                                                    <input className="border border-ink p-2" placeholder="ArcGIS Feature ID" value={tractForm.mapId} onChange={e => setTractForm({ ...tractForm, mapId: e.target.value })} />
                                                </div>
                                                <button onClick={addTract} className="mt-3 px-3 py-1.5 text-xs font-bold border border-ink hover:bg-ink hover:text-parchment transition-colors">Add Tract</button>
                                            </div>
                                            <div className="border border-ink/20 rounded-xl p-3 bg-parchment overflow-auto">
                                                <h3 className="text-xs font-bold uppercase tracking-widest mb-3">Tract Registry</h3>
                                                <table className="w-full text-xs">
                                                    <thead><tr className="border-b border-ink/20"><th className="text-left py-1">Code</th><th className="text-left py-1">Name</th><th className="text-left py-1">Acres</th><th className="text-left py-1">Map ID</th><th className="text-right py-1">Actions</th></tr></thead>
                                                    <tbody>
                                                        {tracts.map(t => <tr key={t.id} className="border-b border-ink/10"><td className="py-1">{t.code}</td><td>{t.name || '-'}</td><td>{t.acres || '-'}</td><td>{t.mapId || '-'}</td><td className="text-right"><button onClick={() => removeTract(t.id)} className="text-stamp hover:underline">Remove</button></td></tr>)}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {researchTab === 'contacts' && (
                                        <div className="p-6">
                                            <div className="border border-dashed border-ink/40 rounded-xl p-6 bg-parchment text-center">
                                                <h3 className="text-sm font-bold uppercase tracking-widest mb-2">Contacts Placeholder</h3>
                                                <p className="text-xs opacity-70">Contact workflows are temporarily hidden while we redesign this area.</p>
                                            </div>
                                        </div>
                                    )}

                                    {false && (
                                        <div className="p-4 grid lg:grid-cols-3 gap-4">
                                            <div className="border border-ink/20 rounded-xl p-3 bg-parchment lg:col-span-1">
                                                <h3 className="text-xs font-bold uppercase tracking-widest mb-3">Add Interest</h3>
                                                <div className="space-y-2 text-xs">
                                                    <select className="w-full border border-ink p-2" value={interestForm.contactId} onChange={e => setInterestForm({ ...interestForm, contactId: e.target.value })}><option value="">Contact</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                                    <select className="w-full border border-ink p-2" value={interestForm.tractId} onChange={e => setInterestForm({ ...interestForm, tractId: e.target.value })}><option value="">Tract</option>{tracts.map(t => <option key={t.id} value={t.id}>{t.code} {t.name ? `- ${t.name}` : ''}</option>)}</select>
                                                    <select className="w-full border border-ink p-2" value={interestForm.interestType} onChange={e => setInterestForm({ ...interestForm, interestType: e.target.value })}><option value="MI">MI</option><option value="RI">RI</option><option value="NRI">NRI</option><option value="ORRI">ORRI</option></select>
                                                    <input className="w-full border border-ink p-2" type="number" step="0.00000001" placeholder="Interest (decimal)" value={interestForm.interestValue} onChange={e => setInterestForm({ ...interestForm, interestValue: e.target.value })} />
                                                    <select className="w-full border border-ink p-2" value={interestForm.status} onChange={e => setInterestForm({ ...interestForm, status: e.target.value })}><option value="confirmed">Confirmed</option><option value="proposed">Proposed</option><option value="disputed">Disputed</option></select>
                                                </div>
                                                <button onClick={addInterest} className="mt-3 px-3 py-1.5 text-xs font-bold border border-ink hover:bg-ink hover:text-parchment transition-colors">Add Interest</button>
                                            </div>
                                            <div className="border border-ink/20 rounded-xl p-3 bg-parchment overflow-auto lg:col-span-2">
                                                <h3 className="text-xs font-bold uppercase tracking-widest mb-3">Owner × Tract Matrix</h3>
                                                <table className="w-full text-xs whitespace-nowrap">
                                                    <thead>
                                                        <tr className="border-b border-ink/20">
                                                            <th className="text-left py-1 pr-2">Owner</th>
                                                            {tracts.map(t => <th key={t.id} className="text-left py-1 px-2">{t.code}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {contacts.map(c => (
                                                            <tr key={c.id} className="border-b border-ink/10">
                                                                <td className="py-1 pr-2 font-bold">{c.name}</td>
                                                                {tracts.map(t => {
                                                                    const records = interestsByContactAndTract[`${c.id}::${t.id}`] || [];
                                                                    return <td key={t.id} className="px-2 py-1">{records.length ? records.map(r => <span key={r.id} className="inline-flex items-center gap-1 mr-1">{r.interestType}:{r.interestValue}<button onClick={() => removeInterest(r.id)} className="text-stamp" title="Remove interest">×</button></span>) : '-'}</td>;
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {/* -------------------- DESK MAP (INTERACTIVE TREE) -------------------- */}
                        {view === 'chart' && (
                            <div 
                                className={`flex-1 overflow-hidden relative parchment-grid ${isDragging.current ? 'cursor-grabbing select-none' : 'cursor-grab'} animate-fade-in no-print rounded-2xl`}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onWheel={handleWheel}
                            >
                                <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-parchment/95 border border-ink/30 rounded-lg px-2 py-2 ink-shadow">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-sepia">DeskMap</span>
                                    <select className="border border-ink p-1 text-xs min-w-[180px]" value={activeDeskMapId} onChange={e => setActiveDeskMapId(e.target.value)}>
                                        {deskMaps.map(map => <option key={map.id} value={map.id}>{formatDeskMapLabel(map)}</option>)}
                                    </select>
                                    <button onClick={addDeskMap} className="px-2 py-1 text-[10px] font-bold border border-ink hover:bg-ink hover:text-parchment transition-colors">+ DeskMap</button>
                                    <input value={deskMapCodeDraft} onChange={e => { setIsEditingDeskMapName(true); setDeskMapCodeDraft(e.target.value); }} onBlur={() => renameActiveDeskMap()} onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            renameActiveDeskMap(deskMapNameDraft, e.currentTarget.value);
                                        }
                                    }} className="border border-ink/40 p-1 text-xs w-[110px] bg-parchment" placeholder="Tract code" />
                                    <input value={deskMapNameDraft} onChange={e => { setIsEditingDeskMapName(true); setDeskMapNameDraft(e.target.value); }} onBlur={() => renameActiveDeskMap()} onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            renameActiveDeskMap(e.currentTarget.value, deskMapCodeDraft);
                                        }
                                    }} className="border border-ink/40 p-1 text-xs min-w-[140px] bg-parchment" placeholder="DeskMap name" />
                                    <button onClick={() => renameActiveDeskMap()} className="px-2 py-1 text-[10px] font-bold border border-ink/40 hover:bg-teastain transition-colors">Save Name</button>
                                </div>
                                <div style={{ transform: `translate(${pz.x}px, ${pz.y}px) scale(${pz.scale})`, transformOrigin: '0 0' }} className="w-max h-max min-w-full min-h-full flex justify-start pt-24 pb-48 gap-24">
                                    {tree.map(n => renderTreeNode(n))}
                                </div>
                            </div>
                        )}

                        {/* -------------------- FLOW CHART ENGINE -------------------- */}
                        {view === 'flowchart' && (
                            <div className="flex-1 overflow-hidden relative parchment-grid animate-fade-in flex flex-col print-canvas-container rounded-2xl">
                                
                                {/* UI Toolbar (Hidden on actual print) */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-parchment/95 border border-ink/30 ink-shadow-lg z-50 flex items-center p-2 gap-2 no-print rounded-2xl max-w-[94vw]">
                                    <div className="flex items-center gap-2 bg-teastain border border-ink px-2 py-1 rounded-md">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-ink" htmlFor="flow-tool-select">Tool</label>
                                        <select
                                            id="flow-tool-select"
                                            value={flowTool}
                                            onChange={e => setFlowTool(e.target.value)}
                                            aria-label="Flowchart active tool"
                                            className="px-2 py-1 text-[10px] font-bold uppercase border border-ink/30 bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
                                        >
                                            <option value="select">Move Box</option>
                                            <option value="move-tree">Move Tree</option>
                                            <option value="pan">Pan Canvas</option>
                                            <option value="connect">Link Boxes</option>
                                        </select>
                                    </div>

                                    <button onClick={() => addFlowNode('template')} aria-label="Add templated flowchart box" className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"><Icon name="Plus" size={12}/> Box</button>
                                    <button onClick={() => addFlowNode('blank')} aria-label="Add blank note box" className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"><Icon name="Plus" size={12}/> Note</button>
                                    <button onClick={() => fitFlowToView()} aria-label="Fit all flow nodes to view" className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink/40 text-ink hover:bg-ink hover:text-parchment flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" title="Recenter and fit all flow nodes to the current canvas"><Icon name="Move" size={12}/> Fit View</button>
                                    <button onClick={handlePrintFlowchart} aria-label="Print flowchart" className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-ink text-parchment hover:bg-ink/80 flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"><Icon name="Printer" size={12}/> Print</button>

                                    <div className="relative" ref={flowLayoutMenuRef}>
                                        <button
                                            onClick={() => setShowFlowLayoutMenu(v => !v)}
                                            aria-label="Toggle layout and import controls"
                                            aria-haspopup="menu"
                                            aria-expanded={showFlowLayoutMenu}
                                            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia text-sepia hover:bg-sepia hover:text-parchment flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
                                        >
                                            <Icon name="List" size={12}/> Layout & Import
                                        </button>

                                        {showFlowLayoutMenu && (
                                            <div className="absolute right-0 mt-2 w-[320px] bg-parchment border border-ink/40 ink-shadow-lg rounded-lg p-3 space-y-3" role="menu" aria-label="Layout and import controls">
                                                <div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-ink/60 mb-1 flex items-center gap-1"><Icon name="Chart" size={11}/> Paper Boundaries</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase text-ink">Grid</span>
                                                        <div className="flex items-center">
                                                            <button onClick={() => setGridCols(c => Math.max(1, c-1))} aria-label="Decrease grid columns" className="w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">-</button>
                                                            <span className="w-5 text-center text-[10px] font-mono font-bold" aria-label={`Grid columns ${gridCols}`}>{gridCols}</span>
                                                            <button onClick={() => setGridCols(c => c+1)} aria-label="Increase grid columns" className="w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">+</button>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-ink/50">x</span>
                                                        <div className="flex items-center">
                                                            <button onClick={() => setGridRows(r => Math.max(1, r-1))} aria-label="Decrease grid rows" className="w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">-</button>
                                                            <span className="w-5 text-center text-[10px] font-mono font-bold" aria-label={`Grid rows ${gridRows}`}>{gridRows}</span>
                                                            <button onClick={() => setGridRows(r => r+1)} aria-label="Increase grid rows" className="w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-ink">Scale</span>
                                                        <input
                                                            type="range"
                                                            min="0.2"
                                                            max="1.5"
                                                            step="0.05"
                                                            value={treeScale}
                                                            onChange={e => setTreeScale(Number(e.target.value))}
                                                            aria-label="Adjust tree scale"
                                                            className="w-full accent-sepia cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
                                                            title="Scale the tree to fit inside the paper bounds"
                                                        />
                                                    </div>
                                                    <button onClick={() => setPrintOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')} aria-label="Toggle print orientation" className="mt-2 px-2 py-1.5 w-full text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">
                                                        <Icon name="FileText" size={12}/> {printOrientation === 'portrait' ? 'Portrait' : 'Landscape'}
                                                    </button>
                                                </div>

                                                <div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-ink/60 mb-1 flex items-center gap-1"><Icon name="Download" size={11}/> Import Source</div>
                                                    <select value={flowDeskMapFilter} onChange={e => setFlowDeskMapFilter(e.target.value)} aria-label="Flow source selector" className="w-full px-2 py-1.5 text-[10px] font-bold border border-ink/30 bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia">
                                                        <option value="active">Flow Source: Active DeskMap</option>
                                                        <option value="all">Flow Source: All DeskMaps</option>
                                                        {deskMaps.map(map => <option key={`flow-${map.id}`} value={map.id}>Flow Source: {map.code} {map.name ? `- ${map.name}` : ''}</option>)}
                                                    </select>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <button onClick={() => importToFlowchart(false)} aria-label="Import selected deskmaps into flowchart" className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia text-sepia hover:bg-sepia hover:text-parchment flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" title="Load selected DeskMap(s) into Flow Chart"><Icon name="Download" size={12}/> Import</button>
                                                        <button onClick={() => importToFlowchart(true)} aria-label="Import and append selected deskmaps into flowchart" className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia/50 text-sepia hover:bg-sepia/10 flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" title="Append selected DeskMap(s) to existing Flow Chart"><Icon name="Plus" size={12}/> Append</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Flowchart Property Panel (Hidden on Print) */}
                                {selectedFlowNode && flowTool === 'select' && (
                                    <div className="absolute top-20 right-4 bg-parchment border border-ink ink-shadow-lg z-50 p-4 w-64 no-print animate-fade-in">
                                        <div className="text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-ink/20 pb-2 flex justify-between items-center">
                                            <span>Box Properties</span>
                                            <button onClick={() => setSelectedFlowNode(null)}><Icon name="Close" size={12}/></button>
                                        </div>
                                        <div className="flex gap-2 mb-4 justify-between">
                                            <button onClick={() => changeNodeColor('bg-parchment text-ink border-ink')} className="w-8 h-8 rounded-sm border border-ink bg-parchment" title="Parchment"></button>
                                            <button onClick={() => changeNodeColor('bg-teastain text-sepia border-sepia')} className="w-8 h-8 rounded-sm border border-sepia bg-teastain" title="Tea-Stain"></button>
                                            <button onClick={() => changeNodeColor('bg-sepia text-parchment border-sepia')} className="w-8 h-8 rounded-sm border border-sepia bg-sepia" title="Sepia"></button>
                                            <button onClick={() => changeNodeColor('bg-ink text-parchment border-ink')} className="w-8 h-8 rounded-sm border border-ink bg-ink" title="Ink"></button>
                                        </div>
                                        <button onClick={() => {
                                            const node = flowNodes.find(n => n.id === selectedFlowNode);
                                            setFlowForm(node.data); setShowFlowEditModal(true);
                                        }} className="w-full py-2 border border-ink mb-2 text-xs font-bold uppercase hover:bg-ink hover:text-parchment transition-colors">Edit Content</button>
                                        <div className="mb-2 border border-ink/20 bg-teastain/20 px-2 py-1.5 text-[10px]">
                                            <div className="font-bold uppercase tracking-widest text-ink/70 mb-1">Tree Group</div>
                                            <label className="flex items-center justify-between gap-2 text-[10px] text-ink">
                                                <span>Move as tree group</span>
                                                <input type="checkbox" checked readOnly aria-label="Move as tree group" />
                                            </label>
                                            <div className="mt-1 font-mono text-[9px] break-all text-ink/70">
                                                {resolveTreeGroupId(flowNodes.find(n => n.id === selectedFlowNode))}
                                            </div>
                                        </div>
                                        <button onClick={deleteSelectedFlowElement} className="w-full py-2 border border-transparent text-stamp hover:border-stamp/50 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2"><Icon name="Trash" size={14}/> Delete Node</button>
                                    </div>
                                )}

                                {/* Outer Zoom Viewport (Interactive Screen View) */}
                                <div 
                                    ref={flowCanvasRef}
                                    className={`flex-1 relative overflow-hidden no-print ${
                                        flowTool === 'pan' ? 'cursor-grab active:cursor-grabbing' 
                                        : flowTool === 'move-tree' ? 'cursor-move' 
                                        : flowTool === 'connect' ? 'cursor-crosshair' 
                                        : 'cursor-default'
                                    }`}
                                    onPointerDown={(e) => {
                                        if (flowTool === 'pan' || flowTool === 'move-tree') handleFlowPointerDown(e);
                                    }}
                                    onPointerMove={handleFlowPointerMove}
                                    onPointerUp={handleFlowPointerUp}
                                    onPointerCancel={handleFlowPointerUp}
                                    onWheel={handleFlowWheel}
                                    onClick={() => flowTool === 'select' && setSelectedFlowNode(null)}
                                >
                                    <div 
                                        className="absolute top-0 left-0 pan-zoom-layer"
                                        style={{ transform: `translate(${flowPz.x}px, ${flowPz.y}px) scale(${flowPz.scale})`, transformOrigin: '0 0' }}
                                    >
                                        {/* Physical Multi-Page "Paper" representation bounds */}
                                        <div
                                            className="paper-visual bg-parchment shadow-[12px_12px_0px_rgba(26,26,27,0.2)] relative border border-ink"
                                            style={{
                                                width: pw * gridCols,
                                                height: ph * gridRows,
                                            }}
                                        >
                                            {/* Safety Margin & Page Break Overlay Guide */}
                                            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                                                {/* Vertical Page Seams */}
                                                {Array.from({length: gridCols - 1}).map((_, i) => (
                                                    <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l-[2px] border-dashed border-stamp/40" style={{ left: (i + 1) * pw }} />
                                                ))}
                                                {/* Horizontal Page Seams */}
                                                {Array.from({length: gridRows - 1}).map((_, i) => (
                                                    <div key={`h-${i}`} className="absolute left-0 right-0 border-t-[2px] border-dashed border-stamp/40" style={{ top: (i + 1) * ph }} />
                                                ))}
                                                {/* Overall Border */}
                                                <div className="absolute inset-0 border border-dashed border-ink/30 m-8 flex items-end justify-end p-2">
                                                    <div className="text-ink/50 font-bold text-[10px] uppercase tracking-widest text-right bg-parchment px-2">
                                                        Print Boundary ({gridCols}x{gridRows} {printOrientation})
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scalable Container FOR THE CONTENTS inside the paper */}
                                            <div 
                                                id="tree-scaler"
                                                className="absolute top-0 left-0 w-full h-full"
                                                style={{ transform: `scale(${treeScale})`, transformOrigin: '0 0' }}
                                            >
                                                {renderTree(true)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* ===================================================================
                                   PRINT ONLY SLICES
                                   This DOM block does not render until the exact moment of printing.
                                   This removes up to thousands of invisible DOM elements, perfectly 
                                   optimizing Flow Chart interaction and drag frames.
                                   ===================================================================
                                */}
                                {isPrinting && (
                                    <div className="print-only w-full">
                                        {Array.from({ length: gridRows }).map((_, r) => 
                                            Array.from({ length: gridCols }).map((_, c) => (
                                                <div key={`print-page-${r}-${c}`} className="print-page-break bg-white" style={{ width: pw + 'px', height: ph + 'px' }}>
                                                    {/* Inside this specific page, we shift the massive canvas container so the correct portion shows through the window */}
                                                    <div className="absolute" style={{ top: -(r * ph) + 'px', left: -(c * pw) + 'px', width: (pw * gridCols) + 'px', height: (ph * gridRows) + 'px' }}>
                                                        <div style={{ transform: `scale(${treeScale})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
                                                            {renderTree(false)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Flow Node Editor Modal */}
                                {showFlowEditModal && flowForm && (
                                    <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in no-print pointer-events-auto">
                                        <div className="bg-parchment border border-ink p-6 w-full max-w-md ink-shadow-lg flex flex-col gap-4 animate-slide-up">
                                            <h3 className="font-serif font-black text-xl border-b-[2px] border-ink pb-2">Edit Canvas Element</h3>
                                            
                                            {flowNodes.find(n => n.id === selectedFlowNode)?.type === 'template' ? (
                                                <>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Instrument Title</label>
                                                        <input type="text" className="w-full border border-ink p-2 bg-teastain" value={flowForm.title} onChange={e => setFlowForm({...flowForm, title: e.target.value})} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Grantee</label>
                                                        <input type="text" className="w-full border border-ink p-2 bg-teastain font-serif font-bold" value={flowForm.grantee} onChange={e => setFlowForm({...flowForm, grantee: e.target.value})} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Grantor</label>
                                                        <input type="text" className="w-full border border-ink p-2 bg-teastain" value={flowForm.grantor} onChange={e => setFlowForm({...flowForm, grantor: e.target.value})} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Date / Vol / Page</label>
                                                            <input type="text" className="w-full border border-ink p-2 bg-teastain" value={flowForm.details} onChange={e => setFlowForm({...flowForm, details: e.target.value})} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Fraction</label>
                                                            <input type="text" className="w-full border border-ink p-2 bg-teastain font-mono" value={flowForm.fraction} onChange={e => setFlowForm({...flowForm, fraction: e.target.value})} />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Text Content</label>
                                                    <textarea className="w-full border border-ink p-2 bg-teastain h-32 font-serif resize-y" value={flowForm.text} onChange={e => setFlowForm({...flowForm, text: e.target.value})} />
                                                    
                                                    <label className="text-[10px] font-bold uppercase tracking-widest block mt-4 mb-1">Box Width: {flowForm.width || 280}px</label>
                                                    <input type="range" min="150" max="800" value={flowForm.width || 280} onChange={e => setFlowForm({...flowForm, width: parseInt(e.target.value)})} className="w-full accent-sepia cursor-pointer" />
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 mt-2">
                                                <button onClick={() => setShowFlowEditModal(false)} className="px-4 py-2 border border-ink/30 text-xs font-bold uppercase tracking-widest hover:border-stamp/50 hover:text-stamp transition-colors">Cancel</button>
                                                <button onClick={commitFlowEdit} className="px-6 py-2 bg-sepia/10 text-sepia border border-sepia/40 text-xs font-bold uppercase tracking-widest hover:-translate-y-0.5 transition-all">Save</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>

                    {/* DYNAMIC RECORD MODAL SYSTEM - VINTAGE STYLING */}
                    {showModal && (
                        <div className="fixed inset-0 bg-ink/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in font-mono text-ink">
                            <div className="bg-parchment border border-ink ink-shadow-lg w-full max-w-5xl overflow-hidden flex flex-col max-h-full animate-slide-up">
                                
                                {/* Modal Header */}
                                <div className={`px-8 py-6 flex justify-between items-center border-b-[2px] border-ink ${
                                    modalMode === 'convey' ? 'bg-sepia text-parchment' : 
                                    modalMode === 'add_related' ? 'bg-fountain text-parchment' : 
                                    modalMode === 'attach' ? 'bg-fountain text-parchment' :
                                    modalMode === 'precede' ? 'bg-ink text-parchment' :
                                    modalMode === 'add_unlinked' ? 'bg-fountain text-parchment' :
                                    modalMode === 'add_chain' ? 'bg-fountain text-parchment' :
                                    'bg-ink text-parchment'
                                }`}>
                                    <div>
                                        <h2 className="text-xl font-serif font-black tracking-tight text-parchment">
                                            {modalMode === 'edit' ? 'Update Record' : 
                                             modalMode === 'add_related' ? 'Attach Related Document' : 
                                             modalMode === 'attach' ? 'Link Imported Document to Lineage' :
                                             modalMode === 'precede' ? 'Insert Preceding Record' :
                                             modalMode === 'add_unlinked' ? 'Add Loose Document' :
                                             modalMode === 'add_chain' ? 'Start New Title Chain' :
                                             'Convey Title Link'}
                                        </h2>
                                        <p className="text-[10px] opacity-80 uppercase font-bold tracking-widest mt-1">
                                            {modalMode === 'add_related' ? 'Non-Conveying Title Work (e.g., Probates, Affidavits)' : 
                                             modalMode === 'add_unlinked' ? 'Parking lot record to be attached to the main lineage later' :
                                             modalMode === 'add_chain' ? 'Independent starting point for a separate lineage map' :
                                             'Protocol Lineage Analysis & Net-interest Database'}
                                        </p>
                                    </div>
                                    <button onClick={() => setShowModal(false)} className="border border-transparent hover:border-current p-2 rounded-sm transition-all">
                                        <Icon name="Close" size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-parchment">
                                    <div className="grid grid-cols-6 gap-6">

                                        {/* ATTACH PARENT SELECTOR */}
                                        {modalMode === 'attach' && (
                                            <div className="col-span-6 bg-teastain border border-ink p-5 mb-2 shadow-inner">
                                                <div className="flex flex-col sm:flex-row gap-6">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-widest">Select Parent Title Link</label>
                                                        <select className="w-full border border-ink rounded-sm p-3 bg-teastain outline-none font-bold" value={attachParentId} onChange={e => setAttachParentId(e.target.value)}>
                                                            {nodes.filter(n => n.parentId !== 'unlinked' && n.id !== activeNode?.id).map(n => (
                                                                <option key={n.id} value={n.id}>{n.instrument} - {n.grantee} ({n.date})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="w-full sm:w-1/3">
                                                        <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-widest">Attachment Type</label>
                                                        <select className="w-full border border-ink rounded-sm p-3 bg-teastain outline-none font-bold" value={attachType} onChange={e => setAttachType(e.target.value)}>
                                                            <option value="conveyance">Conveyance (Math Engine)</option>
                                                            <option value="related">Related Branch Doc</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Instrument Details */}
                                        <div className="col-span-6 sm:col-span-3">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Instrument (B)</label>
                                            {isAddingInst ? (
                                                <div className="flex gap-2">
                                                    <input type="text" className="flex-1 border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none font-bold" value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="New Instrument Type..." autoFocus />
                                                    <button onClick={() => {
                                                        if(newInst.trim() && !instrumentList.includes(newInst.trim())) {
                                                            setInstrumentList([...instrumentList, newInst.trim()]);
                                                            setForm({...form, instrument: newInst.trim()});
                                                        } else if (instrumentList.includes(newInst.trim())) {
                                                            setForm({...form, instrument: newInst.trim()});
                                                        }
                                                        setIsAddingInst(false);
                                                        setNewInst('');
                                                    }} className="px-4 bg-sepia/10 text-sepia border border-sepia/40 font-bold hover:bg-sepia/20 transition-colors">Add</button>
                                                    <button onClick={() => setIsAddingInst(false)} className="px-3 bg-teastain border border-ink hover:border-sepia hover:text-sepia transition-colors"><Icon name="Close" size={16} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <select className="flex-1 border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none font-bold cursor-pointer" value={form.instrument} onChange={(e) => setForm({...form, instrument: e.target.value})}>
                                                        {instrumentList.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                                                    </select>
                                                    <button onClick={() => setIsAddingInst(true)} className="px-3 bg-teastain border border-ink hover:border-sepia hover:text-sepia transition-colors" title="Add New Instrument Type">
                                                        <Icon name="Plus" size={16} />
                                                    </button>
                                                    <button onClick={() => {
                                                        if(instrumentList.length > 1) {
                                                            const newList = instrumentList.filter(i => i !== form.instrument);
                                                            setInstrumentList(newList);
                                                            setForm({...form, instrument: newList[0]});
                                                        }
                                                    }} className="px-3 bg-teastain border border-ink hover:text-stamp hover:border-stamp/50 transition-colors" title="Delete Selected Instrument Type">
                                                        <Icon name="Trash" size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Vol (E)</label>
                                            <input type="text" className="w-full border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none" value={form.vol} onChange={(e) => setForm({...form, vol: e.target.value})} />
                                        </div>
                                        <div className="col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Page (F)</label>
                                            <input type="text" className="w-full border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none" value={form.page} onChange={(e) => setForm({...form, page: e.target.value})} />
                                        </div>
                                        <div className="col-span-6 sm:col-span-1">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Inst No. (G)</label>
                                            <input type="text" className="w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none font-bold " value={form.docNo} onChange={(e) => setForm({...form, docNo: e.target.value})} placeholder="Auto" />
                                        </div>

                                        {/* Parties */}
                                        {(modalMode !== 'add_related' || form.type !== 'related') && (
                                            <div className="col-span-6 sm:col-span-3">
                                                <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-widest text-sepia/80">Grantor / Assignor (J)</label>
                                                <input type="text" className={`w-full border border-ink rounded-sm p-3 ${modalMode === 'convey' ? 'bg-teastain opacity-80' : 'bg-parchment'} outline-none `} value={form.grantor} onChange={(e) => setForm({...form, grantor: e.target.value})} readOnly={modalMode === 'convey'} />
                                            </div>
                                        )}
                                        
                                        <div className={`col-span-6 ${modalMode === 'add_related' || form.type === 'related' ? 'sm:col-span-6' : 'sm:col-span-3'} relative`}>
                                            <div className="flex justify-between items-end mb-1.5">
                                                <label className="text-[10px] font-bold uppercase block tracking-widest text-sepia/80">
                                                    {modalMode === 'add_related' || form.type === 'related' ? 'Subject / Associated Party' : 'Grantee / Assignee (K)'}
                                                </label>
                                                <button 
                                                    onClick={() => setShowGranteeList(!showGranteeList)} 
                                                    className="text-[9px] font-bold uppercase tracking-widest text-sepia/50 hover:text-sepia border-b border-transparent hover:border-sepia/50 transition-colors flex items-center gap-1"
                                                >
                                                    <Icon name="List" size={10} /> Existing Parties
                                                </button>
                                            </div>
                                            
                                            <div className="flex gap-2 items-stretch">
                                                <input type="text" className="flex-1 w-full border border-sepia rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none font-serif font-black shadow-[2px_2px_0px_#704214]" value={form.grantee} onChange={(e) => setForm({...form, grantee: e.target.value})} />
                                                <button 
                                                    onClick={() => setForm({...form, isDeceased: !form.isDeceased})} 
                                                    className={`px-4 border border-sepia rounded-sm transition-all flex items-center justify-center shadow-[2px_2px_0px_#704214] ${form.isDeceased ? 'bg-teastain text-sepia' : 'bg-parchment text-sepia/30 hover:text-sepia hover:bg-teastain'}`}
                                                    title={form.isDeceased ? "Remove Graveyard Protocol" : "Mark as Deceased"}
                                                >
                                                    <Icon name="Tombstone" size={20} />
                                                </button>
                                            </div>
                                            
                                            {showGranteeList && (
                                                <div className="absolute top-full left-0 mt-1 w-full bg-teastain border border-ink ink-shadow max-h-48 overflow-y-auto custom-scrollbar z-50">
                                                    {uniqueGrantees.length > 0 ? uniqueGrantees.map(g => (
                                                        <div 
                                                            key={g} 
                                                            className="p-3 border-b border-ink/10 hover:bg-parchment cursor-pointer font-serif font-bold text-sm text-ink truncate transition-colors"
                                                            onClick={() => {
                                                                setForm({...form, grantee: g});
                                                                setShowGranteeList(false);
                                                            }}
                                                        >
                                                            {g}
                                                        </div>
                                                    )) : (
                                                        <div className="p-3 text-xs italic opacity-60">No existing parties found.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Graveyard Input */}
                                        {form.isDeceased && (
                                            <div className="col-span-6 bg-teastain p-4 border border-sepia/50 rounded-sm mt-2 shadow-inner flex flex-col gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest font-mono">Obituary / Date of Death Notes (Fountain Pen)</label>
                                                    <textarea 
                                                        className="w-full border-b-[1.5px] border-sepia/30 p-2 bg-transparent outline-none h-20 text-xl text-fountain resize-none" 
                                                        style={{ fontFamily: '"Homemade Apple", cursive', lineHeight: '1.5' }}
                                                        value={form.obituary || ''} 
                                                        onChange={(e) => setForm({...form, obituary: e.target.value})} 
                                                        placeholder="e.g. Died intestate Oct 4th, 1912..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest font-mono">Reference Hyperlink (Optional)</label>
                                                    <input 
                                                        type="url"
                                                        className="w-full border-b-[1.5px] border-sepia/30 p-2 bg-transparent outline-none text-sm text-fountain font-mono"
                                                        value={form.graveyardLink || ''}
                                                        onChange={(e) => setForm({...form, graveyardLink: e.target.value})}
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Dates */}
                                        <div className="col-span-3">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">File Date (H)</label>
                                            <input type="date" className="w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  text-sm" value={form.fileDate} onChange={(e) => setForm({...form, fileDate: e.target.value})} />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Inst/Eff Date (I)</label>
                                            <input type="date" className="w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  text-sm" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
                                        </div>

                                        {/* Texts */}
                                        <div className="col-span-6">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Land Description (L)</label>
                                            <textarea className="w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  h-16 text-sm" value={form.landDesc} onChange={(e) => setForm({...form, landDesc: e.target.value})} />
                                        </div>

                                        <div className="col-span-6">
                                            <label className="text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80">Remarks (M)</label>
                                            <textarea className="w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  h-14 text-sm" value={form.remarks} onChange={(e) => setForm({...form, remarks: e.target.value})} />
                                        </div>

                                        {/* MATH ENGINE UI */}
                                        {(modalMode === 'convey' || (modalMode === 'attach' && attachType === 'conveyance')) && (() => {
                                            const parentForMath = nodes.find(n => n.id === (modalMode === 'attach' ? attachParentId : activeNode?.id));
                                            return (
                                            <div className="col-span-6 bg-parchment border border-ink rounded-sm p-6  relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-sepia"></div>
                                                
                                                <div className="flex justify-between items-center mb-6 pl-2">
                                                    <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Icon name="Cpu" size={16} /> Math Engine
                                                    </span>
                                                    <div className="flex bg-teastain p-1 border border-ink">
                                                        {['fraction', 'all', 'fixed'].map(m => (
                                                            <button key={m} onClick={() => setForm({...form, conveyanceMode: m})} className={`px-4 py-1.5 text-[10px] font-bold uppercase transition-all ${form.conveyanceMode === m ? 'bg-ink text-parchment' : 'text-ink hover:bg-ink/10'}`}>{m}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                
                                                {form.conveyanceMode === 'fraction' && (
                                                    <div className="mb-6 pl-2">
                                                        <label className="text-[10px] font-bold opacity-70 uppercase tracking-widest block mb-2">Select Calculation Basis</label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <button onClick={() => setForm({...form, splitBasis: 'whole'})} className={`p-3 border text-left transition-all ${form.splitBasis === 'whole' ? 'bg-ink text-parchment border-ink' : 'bg-parchment border-ink text-ink hover:bg-ink/10'}`}>
                                                                <div className="text-[10px] font-bold uppercase mb-1">Whole Tract</div>
                                                                <div className="font-mono text-xs opacity-80">1.00000000</div>
                                                            </button>
                                                            
                                                            <button onClick={() => setForm({...form, splitBasis: 'initial'})} className={`p-3 border text-left transition-all ${form.splitBasis === 'initial' ? 'bg-ink text-parchment border-ink' : 'bg-parchment border-ink text-ink hover:bg-ink/10'}`}>
                                                                <div className="text-[10px] font-bold uppercase mb-1">Original Granted</div>
                                                                <div className="font-mono text-xs opacity-80">{formatFraction(parentForMath?.initialFraction ?? parentForMath?.fraction)}</div>
                                                            </button>

                                                            <button onClick={() => setForm({...form, splitBasis: 'remaining'})} className={`p-3 border text-left transition-all ${form.splitBasis === 'remaining' ? 'bg-ink text-parchment border-ink' : 'bg-parchment border-ink text-ink hover:bg-ink/10'}`}>
                                                                <div className="text-[10px] font-bold uppercase mb-1">Remaining Share</div>
                                                                <div className="font-mono text-xs opacity-80">{formatFraction(parentForMath?.fraction)}</div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-teastain p-5 border border-ink ml-2">
                                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                                        {form.conveyanceMode === 'fraction' && (
                                                            <>
                                                                <div className="relative">
                                                                    <div className="text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0">Numerator</div>
                                                                    <input type="number" className="w-20 p-3 text-center font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner" value={form.numerator === 0 ? '' : form.numerator} placeholder="1" onFocus={e => e.target.select()} onChange={e => setForm({...form, numerator: e.target.value})} />
                                                                </div>
                                                                <span className="font-black text-ink opacity-40 text-2xl pt-2">/</span>
                                                                <div className="relative">
                                                                    <div className="text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0">Denominator</div>
                                                                    <input type="number" className="w-24 p-3 text-center font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner" value={form.denominator === 0 ? '' : form.denominator} placeholder="2" onFocus={e => e.target.select()} onChange={e => setForm({...form, denominator: e.target.value})} />
                                                                </div>
                                                            </>
                                                        )}
                                                        {form.conveyanceMode === 'fixed' && (
                                                            <div className="relative w-full">
                                                                <div className="text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0">Fixed Decimal Amount</div>
                                                                <input type="number" step="0.00000001" className="w-full sm:w-48 p-3 font-mono font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner" value={form.manualAmount === 0 ? '' : form.manualAmount} placeholder="0.000" onFocus={e => e.target.select()} onChange={e => setForm({...form, manualAmount: e.target.value})} />
                                                            </div>
                                                        )}
                                                        {form.conveyanceMode === 'all' && (
                                                            <div className="text-sm font-bold bg-ink text-parchment px-4 py-2 border border-ink">Transferring 100% of Balance</div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                                                        <div className="text-left sm:text-right">
                                                            <div className="text-[10px] font-bold uppercase text-sepia mb-0.5 tracking-widest">To Be Conveyed</div>
                                                            <div className="text-2xl font-black font-mono tracking-tight">{formatFraction(calcShare)}</div>
                                                        </div>
                                                        <div className={`px-4 py-2 border text-left sm:text-right transition-colors ${ (parentForMath?.fraction - calcShare) < -0.00000001 ? 'bg-[#E0D7D7] border-stamp/50' : 'bg-parchment border-ink ' }`}>
                                                            <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${ (parentForMath?.fraction - calcShare) < -0.00000001 ? 'text-stamp' : 'opacity-60' }`}>Grantor Retention Balance</div>
                                                            <div className={`font-mono text-xs flex items-center sm:justify-end gap-2 ${ (parentForMath?.fraction - calcShare) < -0.00000001 ? 'text-stamp font-bold' : '' }`}>
                                                                <span>{formatFraction(parentForMath?.fraction)}</span>
                                                                <span className="opacity-40">-</span>
                                                                <span>{formatFraction(calcShare)}</span>
                                                                <span className="opacity-40">=</span>
                                                                <span className={`text-sm border-l border-ink pl-2 ${ (parentForMath?.fraction - calcShare) < -0.00000001 ? 'text-stamp' : 'font-bold' }`}>{formatFraction(parentForMath?.fraction - calcShare)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })()}

                                        {/* PREDECESSOR MATH ENGINE UI */}
                                        {modalMode === 'precede' && (
                                            <div className="col-span-6 bg-parchment border border-ink rounded-sm p-6 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-sepia"></div>
                                                
                                                <div className="flex justify-between items-center mb-6 pl-2">
                                                    <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Icon name="ArrowUp" size={16} /> Predecessor Math Engine
                                                    </span>
                                                </div>
                                                
                                                <div className="flex flex-col sm:flex-row items-start justify-between gap-6 bg-teastain p-5 border border-ink ml-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-sepia uppercase tracking-widest block mb-2">Predecessor Total Interest Received</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.00000001" 
                                                            className="w-full sm:w-64 p-3 font-mono font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner" 
                                                            value={form.initialFraction === 0 ? '' : form.initialFraction} 
                                                            onFocus={e => e.target.select()} 
                                                            onChange={e => setForm({...form, initialFraction: parseFloat(e.target.value) || 0})} 
                                                        />
                                                        <p className="text-[9px] opacity-60 mt-2 font-mono uppercase tracking-wider max-w-[250px]">
                                                            The amount the newly discovered predecessor originally acquired.
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                                        <div className="px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full">
                                                            <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Succession Deduction</div>
                                                            <div className="font-mono text-xs flex items-center sm:justify-end gap-2">
                                                                <span title="Predecessor Interest">{formatFraction(form.initialFraction)}</span>
                                                                <span className="opacity-40">-</span>
                                                                <span title="Successor Interest (Current Record)">{formatFraction(activeNode?.initialFraction)}</span>
                                                                <span className="opacity-40">=</span>
                                                                <span className="text-sm border-l border-ink pl-2 font-bold text-sepia">
                                                                    {formatFraction((form.initialFraction || 0) - (activeNode?.initialFraction || 0))}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] uppercase font-bold text-sepia/60 tracking-widest">Calculated Predecessor Retained Balance</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(modalMode === 'edit' || modalMode === 'add_chain') && form.type !== 'related' && form.parentId !== 'unlinked' && (
                                            <>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest">Initial Granted Share {modalMode === 'edit' ? '(Override)' : ''}</label>
                                                    <input type="number" step="0.00000001" className="w-full border border-ink p-3 bg-teastain font-bold focus:ring-2 focus:ring-sepia outline-none" value={form.initialFraction === 0 ? '' : form.initialFraction} onFocus={e => e.target.select()} onChange={(e) => setForm({...form, initialFraction: parseFloat(e.target.value) || 0})} />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest">Remaining Retained Share {modalMode === 'edit' ? '(Override)' : ''}</label>
                                                    <input type="number" step="0.00000001" className="w-full border border-ink p-3 bg-teastain font-bold focus:ring-2 focus:ring-sepia outline-none" value={form.fraction === 0 ? '' : form.fraction} onFocus={e => e.target.select()} onChange={(e) => setForm({...form, fraction: parseFloat(e.target.value) || 0})} />
                                                </div>
                                            </>
                                        )}

                                        {/* File Upload Area */}
                                        <div className="col-span-6 pt-2">
                                            <div className="flex items-center gap-4 p-4 border border-dashed border-ink bg-teastain hover:bg-[#D9D1BF] transition-colors">
                                                <div className="bg-teastain p-3 border border-sepia/30">
                                                    <Icon name="Upload" size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-sepia/80">Vault PDF Link</h4>
                                                    <p className="text-[10px] text-sepia/60 mt-0.5">Uploading automatically populates the Inst No. field.</p>
                                                </div>
                                                <input type="file" ref={modalUploadRef} onChange={handleDocSelection} accept=".pdf" className="hidden" />
                                                
                                                <div className="flex gap-2">
                                                    {form.docData && (
                                                        <button onClick={() => setViewerData(form.docData)} className="px-4 py-2 bg-teastain border border-ink font-bold text-xs hover:border-sepia hover:text-sepia flex items-center gap-2 transition-colors">
                                                            <Icon name="Eye" size={14}/> View
                                                        </button>
                                                    )}
                                                    <button onClick={() => modalUploadRef.current.click()} className="px-6 py-2 bg-sepia/10 text-sepia border border-sepia/40 font-bold uppercase text-xs hover:bg-sepia/20 transition-all tracking-widest">
                                                        Browse
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 bg-parchment border-t border-ink flex gap-4">
                                    <button onClick={handleCommit} className={`flex-1 py-4 text-parchment font-black uppercase tracking-widest transition-all border border-ink hover:-translate-y-0.5 ${
                                        modalMode === 'edit' ? 'bg-ink' : 
                                        modalMode === 'add_related' ? 'bg-fountain' :
                                        modalMode === 'attach' ? 'bg-fountain' :
                                        modalMode === 'precede' ? 'bg-ink' :
                                        modalMode === 'add_unlinked' ? 'bg-fountain' :
                                        modalMode === 'add_chain' ? 'bg-fountain' :
                                        'bg-sepia'
                                    }`}>
                                        Commit {modalMode === 'add_related' ? 'Document' : modalMode === 'attach' ? 'Linked Record' : modalMode === 'precede' ? 'Predecessor' : modalMode === 'add_unlinked' ? 'Loose Record' : modalMode === 'add_chain' ? 'New Chain' : 'Transaction'}
                                    </button>
                                    <button onClick={() => setShowModal(false)} className="px-10 py-4 bg-teastain border border-ink hover:border-stamp hover:text-stamp font-bold uppercase tracking-widest transition-colors hover:-translate-y-0.5">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONFIRMATION MODAL */}
                    {confirmAction && (
                        <div className="fixed inset-0 bg-ink/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in font-mono text-ink no-print">
                            <div className="bg-parchment border border-stamp/40 p-8 ink-shadow-lg max-w-sm w-full text-center animate-slide-up">
                                <div className="text-stamp flex items-center justify-center mx-auto mb-4 border border-stamp/50 w-16 h-16 bg-stamp/10">
                                    <Icon name="Trash" size={32} />
                                </div>
                                <h3 className="text-xl font-serif font-black mb-2 text-stamp">{confirmAction.title}</h3>
                                <p className="text-sm opacity-70 mb-8 leading-relaxed">{confirmAction.message}</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 border border-ink bg-teastain hover:bg-ink hover:text-parchment font-bold transition-colors uppercase tracking-widest text-xs ">Cancel</button>
                                    <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="flex-1 py-3 border border-stamp/50 bg-stamp/20 text-stamp font-bold hover:bg-stamp/30 transition-colors uppercase tracking-widest text-xs">{confirmAction.actionText}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PDF VIEWER MODAL */}
                    {viewerData && (
                        <div className="fixed inset-0 bg-ink/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in font-mono no-print">
                            <div className="w-full max-w-7xl h-full flex flex-col bg-parchment border border-ink ink-shadow-lg">
                                <div className="bg-teastain p-4 text-sepia flex justify-between items-center border-b border-ink">
                                    <div className="flex items-center gap-3">
                                        <div className="border border-ink p-2 bg-parchment"><Icon name="FileText" size={20} /></div>
                                        <span className="text-base font-serif font-black tracking-tight uppercase text-sepia">Vault Viewport</span>
                                    </div>
                                    <button onClick={() => setViewerData(null)} className="p-2 border border-transparent hover:border-ink transition-colors">
                                        <Icon name="Close" size={20} />
                                    </button>
                                </div>
                                <object data={viewerData} type="application/pdf" className="w-full h-full border-none bg-[#111d2d]">
                                    <div className="flex flex-col items-center justify-center h-full p-20 text-center bg-teastain text-ink">
                                        <Icon name="FileText" size={48} className="opacity-50 mb-4" />
                                        <p className="opacity-70 mb-6 font-bold">Your browser does not support inline PDFs.</p>
                                        <a href={viewerData} target="_blank" className="bg-ink text-parchment px-8 py-3 border border-ink font-bold transition-colors ">Open External Tab</a>
                                    </div>
                                </object>
                            </div>
                        </div>
                    )}
                </div>
                )}
                </>
            );
        };

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
    

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => {
            console.error('Service worker registration failed:', error);
        });
    });
}
