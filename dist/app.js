const { useState, useMemo, useRef, useEffect, useCallback } = React;
const { flushSync } = ReactDOM;
const appId = "default-app-id";
const workspaceStorageApi = globalThis.LANDroidWorkspaceStorage;
if (!workspaceStorageApi) {
  throw new Error("LANDroidWorkspaceStorage API is unavailable. Ensure dist/workspaceStorage.js is loaded before app.jsx.");
}
const storageProviderApi = globalThis.LANDroidStorageProvider || {};
const createLocalStorageProvider = storageProviderApi.createLocalStorageProvider;
if (!createLocalStorageProvider) {
  throw new Error("LANDroidStorageProvider API is unavailable. Ensure dist/storageProvider.js is loaded before app.jsx.");
}
const workspaceProvider = createLocalStorageProvider(workspaceStorageApi);
const {
  getLastWorkspaceId,
  listWorkspaces,
  loadWorkspace,
  saveWorkspace,
  deleteWorkspace,
  deleteAllWorkspaces,
  getLatestWorkspace
} = workspaceProvider;
const workspaceDomainApi = globalThis.LANDroidWorkspaceDomain || {};
const toWorkspaceSavePayload = workspaceDomainApi.toWorkspaceSavePayload || ((state) => state);
const fromStoredWorkspace = workspaceDomainApi.fromStoredWorkspace || ((payload) => payload);
const auditLogApi = globalThis.LANDroidAuditLog || {};
const recordAuditEvent = auditLogApi.recordAuditEvent || (() => null);
const listAuditEvents = auditLogApi.listAuditEvents || (() => []);
const getRecentBranchAuditEvents = () => {
  try {
    return listAuditEvents().filter((event) => event?.type === "branch_recalculated").slice(0, 8);
  } catch (_error) {
    return [];
  }
};
const syncEngineApi = globalThis.LANDroidSyncEngine || {};
const getSyncSummary = syncEngineApi.getSyncSummary || (() => ({ pendingCount: 0, status: "synced", lastOperationAt: null }));
const dropboxIntegrationApi = globalThis.LANDroidDropboxIntegration || {};
const normalizeAttachmentMetadata = dropboxIntegrationApi.normalizeAttachmentMetadata || (() => null);
const mathEngineApi = globalThis.LANDroidMathEngine || {};
const requireMathEngineFunction = (name) => {
  const fn = mathEngineApi[name];
  if (typeof fn !== "function") {
    throw new Error(`LANDroidMathEngine.${name} is unavailable. Ensure dist/mathEngine.js is loaded before app.jsx.`);
  }
  return fn;
};
const FRACTION_EPSILON = mathEngineApi.FRACTION_EPSILON || 1e-10;
const clampFraction = mathEngineApi.clampFraction || ((value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0 && numeric > -FRACTION_EPSILON) return 0;
  return Math.max(0, numeric);
});
const collectDescendantIds = mathEngineApi.collectDescendantIds || (() => /* @__PURE__ */ new Set());
const calculateShare = mathEngineApi.calculateShare || (() => 0);
const executeConveyance = requireMathEngineFunction("executeConveyance");
const executeRebalance = requireMathEngineFunction("executeRebalance");
const executePredecessorInsert = requireMathEngineFunction("executePredecessorInsert");
const executeAttachConveyance = requireMathEngineFunction("executeAttachConveyance");
const validateOwnershipGraph = requireMathEngineFunction("validateOwnershipGraph");
const rootOwnershipTotal = mathEngineApi.rootOwnershipTotal || (() => 0);
const formatAsFraction = mathEngineApi.formatAsFraction || ((value) => `${Number(value || 0)}/1`);
const Icon = ({ name, size = 18, className = "" }) => {
  const icons = {
    Plus: /* @__PURE__ */ React.createElement("path", { d: "M12 5v14M5 12h14" }),
    Minus: /* @__PURE__ */ React.createElement("path", { d: "M5 12h14" }),
    Trash: /* @__PURE__ */ React.createElement("path", { d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" }),
    Download: /* @__PURE__ */ React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }),
    Upload: /* @__PURE__ */ React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" }),
    Printer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M6 9V2h12v7" }), /* @__PURE__ */ React.createElement("path", { d: "M6 18H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-2" }), /* @__PURE__ */ React.createElement("rect", { x: "6", y: "14", width: "12", height: "8" })),
    Adjust: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("line", { x1: "4", y1: "6", x2: "20", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "4", y1: "12", x2: "20", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "4", y1: "18", x2: "20", y2: "18" }), /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "6", r: "2", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "16", cy: "12", r: "2", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "10", cy: "18", r: "2", fill: "currentColor", stroke: "none" })),
    List: /* @__PURE__ */ React.createElement("path", { d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" }),
    Close: /* @__PURE__ */ React.createElement("path", { d: "M18 6L6 18M6 6l12 12" }),
    Eye: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" })),
    Convey: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M21 3L14.3 21.4a.5.5 0 0 1-.9 0L10 14l-7.4-3.4a.5.5 0 0 1 0-.9L21 3Z" }), /* @__PURE__ */ React.createElement("path", { d: "M21 3L10 14" })),
    ArrowUp: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "19", x2: "12", y2: "5" }), /* @__PURE__ */ React.createElement("polyline", { points: "5 12 12 5 19 12" })),
    Cpu: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("rect", { x: "9", y: "9", width: "6", height: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "1", x2: "9", y2: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "15", y1: "1", x2: "15", y2: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "20", x2: "9", y2: "23" }), /* @__PURE__ */ React.createElement("line", { x1: "15", y1: "20", x2: "15", y2: "23" }), /* @__PURE__ */ React.createElement("line", { x1: "20", y1: "9", x2: "23", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "20", y1: "15", x2: "23", y2: "15" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "9", x2: "4", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "15", x2: "4", y2: "15" })),
    Chart: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "3", x2: "9", y2: "21" }), /* @__PURE__ */ React.createElement("line", { x1: "15", y1: "3", x2: "15", y2: "21" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "9", x2: "21", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "15", x2: "21", y2: "15" })),
    FileText: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), /* @__PURE__ */ React.createElement("polyline", { points: "14 2 14 8 20 8" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), /* @__PURE__ */ React.createElement("polyline", { points: "10 9 9 9 8 9" })),
    Paperclip: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" })),
    Clock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("polyline", { points: "12 6 12 12 16 14" })),
    Link: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }), /* @__PURE__ */ React.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })),
    Cloud: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" })),
    Tombstone: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M7 2h10a5 5 0 0 1 5 5v15H2V7a5 5 0 0 1 5-5z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "8", x2: "15", y2: "8" })),
    Flowchart: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "6", height: "6", rx: "1" }), /* @__PURE__ */ React.createElement("rect", { x: "15", y: "3", width: "6", height: "6", rx: "1" }), /* @__PURE__ */ React.createElement("rect", { x: "9", y: "15", width: "6", height: "6", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "13", x2: "12", y2: "15" })),
    MousePointer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" }), /* @__PURE__ */ React.createElement("path", { d: "M13 13l6 6" })),
    Move: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("polyline", { points: "5 9 2 12 5 15" }), /* @__PURE__ */ React.createElement("polyline", { points: "9 5 12 2 15 5" }), /* @__PURE__ */ React.createElement("polyline", { points: "19 9 22 12 19 15" }), /* @__PURE__ */ React.createElement("polyline", { points: "9 19 12 22 15 19" }), /* @__PURE__ */ React.createElement("line", { x1: "2", y1: "12", x2: "22", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "2", x2: "12", y2: "22" })),
    Hand: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M18 11V6a2 2 0 0 0-4 0v4" }), /* @__PURE__ */ React.createElement("path", { d: "M14 10V4a2 2 0 0 0-4 0v6" }), /* @__PURE__ */ React.createElement("path", { d: "M10 10.5V3a2 2 0 0 0-4 0v9" }), /* @__PURE__ */ React.createElement("path", { d: "M6 12v-1a2 2 0 0 0-4 0v5a10 10 0 0 0 20 0v-5a2 2 0 0 0-4 0v-4.5" })),
    Users: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("circle", { cx: "8.5", cy: "7", r: "4" }), /* @__PURE__ */ React.createElement("path", { d: "M20 8v6" }), /* @__PURE__ */ React.createElement("path", { d: "M23 11h-6" })),
    Table: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "1" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "4", x2: "9", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "15", y1: "4", x2: "15", y2: "20" })),
    MapPin: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "11", r: "2.5" }))
  };
  return /* @__PURE__ */ React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className }, icons[name] || null);
};
const App = () => {
  const makeId = () => Math.random().toString(36).slice(2, 11);
  const defaultRoot = {
    id: "root",
    instrument: "Original Grant",
    vol: "",
    page: "",
    docNo: "LAND_GRANT_001",
    fileDate: "1836-03-02",
    date: "1836-03-02",
    grantor: "State Government",
    grantee: "Original Grantee",
    landDesc: "All that certain tract...",
    remarks: "Root of Title",
    fraction: 1,
    initialFraction: 1,
    parentId: null,
    docData: "",
    type: "conveyance",
    isDeceased: false,
    obituary: "",
    graveyardLink: ""
  };
  const defaultViewport = { x: 0, y: 0, scale: 1 };
  const defaultFlowViewport = { x: 0, y: 0, scale: 1 };
  const defaultFlowGrid = { cols: 1, rows: 1 };
  const createDeskMap = ({ name = "Unit Tract 1", code = "TRACT-1", tractId = null } = {}) => ({
    id: makeId(),
    name,
    code,
    tractId,
    nodes: [{ ...defaultRoot }],
    pz: { ...defaultViewport }
  });
  const [nodes, setNodes] = useState([defaultRoot]);
  const [deskMaps, setDeskMaps] = useState([]);
  const [activeDeskMapId, setActiveDeskMapId] = useState("");
  const skipDeskMapSyncRef = useRef(false);
  const [view, setView] = useState("chart");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("edit");
  const [activeNode, setActiveNode] = useState(null);
  const [viewerData, setViewerData] = useState(null);
  const [showOnlyConveyances, setShowOnlyConveyances] = useState(false);
  const [runsheetDeskMapFilter, setRunsheetDeskMapFilter] = useState("active");
  const [flowDeskMapFilter, setFlowDeskMapFilter] = useState("active");
  const [deskMapNameDraft, setDeskMapNameDraft] = useState("");
  const [deskMapCodeDraft, setDeskMapCodeDraft] = useState("");
  const [isEditingDeskMapName, setIsEditingDeskMapName] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const zoomEndTimerRef = useRef(null);
  useEffect(() => {
    flowPzRef.current = flowPz;
  }, [flowPz]);
  useEffect(() => {
    treeScaleRef.current = treeScale;
  }, [treeScale]);
  const modalRef = useRef(null);
  const modalTriggerRef = useRef(null);
  const showModalAndCaptureTrigger = () => {
    modalTriggerRef.current = document.activeElement;
    showModalAndCaptureTrigger();
  };
  useEffect(() => {
    if (!showModal) {
      if (modalTriggerRef.current && typeof modalTriggerRef.current.focus === "function") {
        modalTriggerRef.current.focus();
      }
      return;
    }
    if (modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }
  }, [showModal]);
  const handleModalKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowModal(false);
      return;
    }
    if (e.key !== "Tab" || !modalRef.current) return;
    const focusable = Array.from(modalRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const [flowNodes, setFlowNodes] = useState([]);
  const [flowEdges, setFlowEdges] = useState([]);
  const [flowTool, setFlowTool] = useState("select");
  const [flowPz, setFlowPz] = useState({ ...defaultFlowViewport });
  const flowPzRef = useRef({ ...defaultFlowViewport });
  const [treeScale, setTreeScale] = useState(1);
  const treeScaleRef = useRef(1);
  const [gridCols, setGridCols] = useState(defaultFlowGrid.cols);
  const [gridRows, setGridRows] = useState(defaultFlowGrid.rows);
  const [connectingStart, setConnectingStart] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedFlowNode, setSelectedFlowNode] = useState(null);
  const [showFlowEditModal, setShowFlowEditModal] = useState(false);
  const [flowForm, setFlowForm] = useState(null);
  const [printOrientation, setPrintOrientation] = useState("landscape");
  const [showFlowLayoutMenu, setShowFlowLayoutMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const flowDraggingNode = useRef(null);
  const flowDragStart = useRef({ x: 0, y: 0 });
  const flowCanvasRef = useRef(null);
  const flowLayoutMenuRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const moveTreeStartPos = useRef(null);
  const initialTreeNodes = useRef(null);
  const initialTreeNodeById = useRef(null);
  const moveTreeGroupId = useRef(null);
  const pw = printOrientation === "landscape" ? 1056 : 816;
  const ph = printOrientation === "landscape" ? 816 : 1056;
  const [lastMathProps, setLastMathProps] = useState({ conveyanceMode: "fraction", splitBasis: "initial", numerator: 1, denominator: 2, manualAmount: 0 });
  const [savedProjects, setSavedProjects] = useState([]);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [projectName, setProjectName] = useState("My Workspace");
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [bootChecks, setBootChecks] = useState({ offlineModeActive: false, cloudSyncUnavailable: !navigator.onLine });
  const [syncSummary, setSyncSummary] = useState(() => getSyncSummary());
  const [confirmAction, setConfirmAction] = useState(null);
  const [attachParentId, setAttachParentId] = useState("root");
  const [attachType, setAttachType] = useState("conveyance");
  const fileInput = useRef(null);
  const modalUploadRef = useRef(null);
  const [pz, setPz] = useState({ ...defaultViewport });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const wheelFrameRef = useRef(null);
  const wheelAccumulatedDeltaRef = useRef(0);
  const wheelPointerRef = useRef({ x: 0, y: 0 });
  const zoomIdleTimerRef = useRef(null);
  const chartViewportRef = useRef(null);
  const livePzRef = useRef({ ...defaultViewport });
  const chartPanFrameRef = useRef(null);
  const chartPanPointRef = useRef(null);
  const flowPanFrameRef = useRef(null);
  const flowPanPointRef = useRef(null);
  const [form, setForm] = useState({
    instrument: "",
    vol: "",
    page: "",
    docNo: "",
    fileDate: "",
    date: "",
    grantor: "",
    grantee: "",
    landDesc: "",
    remarks: "",
    fraction: 0,
    initialFraction: 0,
    docData: "",
    conveyanceMode: "fraction",
    splitBasis: "initial",
    type: "conveyance",
    numerator: 1,
    denominator: 2,
    manualAmount: 0,
    isDeceased: false,
    obituary: "",
    graveyardLink: ""
  });
  const [instrumentList, setInstrumentList] = useState([
    "Warranty Deed",
    "Quitclaim Deed",
    "Mineral Deed",
    "Royalty Deed",
    "Deed of Trust",
    "Oil & Gas Lease",
    "Affidavit of Heirship",
    "Probate",
    "Patent",
    "Release",
    "Assignment",
    "Right of Way",
    "Easement",
    "Correction Deed",
    "Original Grant"
  ]);
  const [isAddingInst, setIsAddingInst] = useState(false);
  const [newInst, setNewInst] = useState("");
  const [showGranteeList, setShowGranteeList] = useState(false);
  const [tracts, setTracts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [ownershipInterests, setOwnershipInterests] = useState([]);
  const [contactLogs, setContactLogs] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [researchTab, setResearchTab] = useState("contacts");
  const [tractForm, setTractForm] = useState({ code: "", name: "", acres: "", mapId: "" });
  const [contactForm, setContactForm] = useState({ name: "", role: "", phone: "", email: "" });
  const [interestForm, setInterestForm] = useState({ contactId: "", tractId: "", interestType: "MI", interestValue: "", status: "confirmed" });
  const [logForm, setLogForm] = useState({ contactId: "", tractId: "", method: "call", outcome: "", nextFollowupAt: "", notes: "" });
  const toSortTimestamp = (value) => {
    const ts = Date.parse(value || "");
    return Number.isFinite(ts) ? ts : 0;
  };
  const decorateRunsheetNode = (node, deskMapId, deskMapLabel) => ({
    ...node,
    __deskMapId: deskMapId,
    __deskMapLabel: deskMapLabel,
    __sortTs: toSortTimestamp(node?.date)
  });
  const formatDeskMapLabel = (map) => {
    if (!map) return "DeskMap";
    const code = (map.code || "").trim();
    const name = (map.name || "").trim();
    if (code && name) return `${code} - ${name}`;
    return code || name || "DeskMap";
  };
  const totalRootOwnership = useMemo(() => rootOwnershipTotal(nodes), [nodes]);
  const ownershipHealth = useMemo(() => {
    const delta = totalRootOwnership - 1;
    if (Math.abs(delta) <= FRACTION_EPSILON) return { status: "balanced", label: "Balanced", delta };
    if (delta > 0) return { status: "over", label: "Over", delta };
    return { status: "under", label: "Under", delta };
  }, [totalRootOwnership]);
  const uniqueGrantees = useMemo(() => [...new Set(nodes.map((n) => n.grantee).filter(Boolean))].sort(), [nodes]);
  const [recentMathAuditEvents, setRecentMathAuditEvents] = useState(() => getRecentBranchAuditEvents());
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const deskMapById = useMemo(() => Object.fromEntries(deskMaps.map((map) => [map.id, map])), [deskMaps]);
  const runsheetAllDecoratedNodes = useMemo(
    () => deskMaps.flatMap((map) => {
      const label = formatDeskMapLabel(map);
      return (map.nodes || []).map((node) => decorateRunsheetNode(node, map.id, label));
    }),
    [deskMaps]
  );
  const runsheetNodesSource = useMemo(() => {
    if (runsheetDeskMapFilter === "all") {
      return runsheetAllDecoratedNodes;
    }
    if (runsheetDeskMapFilter === "active") {
      const activeMap = deskMapById[activeDeskMapId];
      const activeMapLabel = activeMap ? formatDeskMapLabel(activeMap) : "Active DeskMap";
      return (activeMap?.nodes || nodes || []).map((n) => decorateRunsheetNode(n, activeMap?.id || activeDeskMapId, activeMapLabel));
    }
    const chosenMap = deskMapById[runsheetDeskMapFilter];
    return (chosenMap?.nodes || []).map((n) => decorateRunsheetNode(n, chosenMap?.id, chosenMap ? formatDeskMapLabel(chosenMap) : "Selected DeskMap"));
  }, [runsheetDeskMapFilter, runsheetAllDecoratedNodes, activeDeskMapId, nodes, deskMapById]);
  const filteredSortedNodes = useMemo(() => {
    const scopedNodes = showOnlyConveyances ? runsheetNodesSource.filter((n) => n.type !== "related" && n.parentId !== "unlinked") : runsheetNodesSource;
    return [...scopedNodes].sort((a, b) => a.__sortTs - b.__sortTs);
  }, [runsheetNodesSource, showOnlyConveyances]);
  const looseRecordCount = useMemo(
    () => filteredSortedNodes.reduce((count, node) => count + (node.parentId === "unlinked" ? 1 : 0), 0),
    [filteredSortedNodes]
  );
  const tractById = useMemo(() => Object.fromEntries(tracts.map((t) => [t.id, t])), [tracts]);
  const contactById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts]);
  const interestsByContactAndTract = useMemo(() => {
    const bucket = {};
    ownershipInterests.forEach((item) => {
      const key = `${item.contactId}::${item.tractId}`;
      if (!bucket[key]) bucket[key] = [];
      bucket[key].push(item);
    });
    return bucket;
  }, [ownershipInterests]);
  const selectedContact = useMemo(() => selectedContactId ? contactById[selectedContactId] || null : null, [contactById, selectedContactId]);
  const selectedContactLogs = useMemo(() => {
    if (!selectedContactId) return [];
    return contactLogs.filter((l) => l.contactId === selectedContactId).sort((a, b) => new Date(b.contactAt) - new Date(a.contactAt));
  }, [contactLogs, selectedContactId]);
  useEffect(() => {
    if (!deskMaps.length) {
      if (activeDeskMapId) setActiveDeskMapId("");
      return;
    }
    if (!activeDeskMapId || !deskMaps.some((map) => map.id === activeDeskMapId)) {
      setActiveDeskMapId(deskMaps[0].id);
    }
  }, [deskMaps, activeDeskMapId]);
  useEffect(() => {
    const activeMap = deskMaps.find((map) => map.id === activeDeskMapId);
    if (!activeMap) return;
    skipDeskMapSyncRef.current = true;
    setNodes(activeMap.nodes || [{ ...defaultRoot }]);
    setPz(activeMap.pz || { ...defaultViewport });
  }, [activeDeskMapId, deskMaps]);
  useEffect(() => {
    if (isEditingDeskMapName) return;
    const activeMap = deskMaps.find((map) => map.id === activeDeskMapId);
    setDeskMapNameDraft(activeMap?.name || "");
    setDeskMapCodeDraft(activeMap?.code || "");
  }, [activeDeskMapId, deskMaps, isEditingDeskMapName]);
  const refreshRecentMathAuditEvents = useCallback(() => {
    setRecentMathAuditEvents(getRecentBranchAuditEvents());
  }, []);
  const recordBranchRecalculationAudit = useCallback((detail) => {
    recordAuditEvent("branch_recalculated", detail);
    refreshRecentMathAuditEvents();
  }, [refreshRecentMathAuditEvents]);
  const updateActiveDeskMapNodes = (updater) => {
    const mapId = activeDeskMapId;
    if (!mapId) return;
    setNodes((prevNodes) => {
      const nextNodes = typeof updater === "function" ? updater(prevNodes) : updater;
      setDeskMaps((prevMaps) => prevMaps.map((map) => map.id === mapId ? { ...map, nodes: nextNodes } : map));
      return nextNodes;
    });
  };
  useEffect(() => {
    if (!activeDeskMapId) return;
    if (skipDeskMapSyncRef.current) {
      skipDeskMapSyncRef.current = false;
      return;
    }
    setDeskMaps((prev) => prev.map((map) => map.id === activeDeskMapId ? { ...map, nodes, pz } : map));
  }, [nodes, pz, activeDeskMapId]);
  const addDeskMap = () => {
    const mapNumber = deskMaps.length + 1;
    const newMap = createDeskMap({ name: `Unit Tract ${mapNumber}`, code: `TRACT-${mapNumber}` });
    setDeskMaps((prev) => [...prev, newMap]);
    setActiveDeskMapId(newMap.id);
  };
  const renameActiveDeskMap = (rawName = deskMapNameDraft, rawCode = deskMapCodeDraft) => {
    const trimmedName = (rawName || "").trim();
    const trimmedCode = (rawCode || "").trim();
    if (!trimmedName && !trimmedCode) return;
    setDeskMaps((prev) => prev.map((map) => map.id === activeDeskMapId ? {
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
    setDeskMaps((prev) => {
      let updated = [...prev];
      tracts.forEach((tract) => {
        const exists = updated.some((map) => map.tractId === tract.id);
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
      if (event.key !== "Escape") return;
      if (showFlowLayoutMenu) setShowFlowLayoutMenu(false);
      if (showActionsMenu) setShowActionsMenu(false);
    };
    document.addEventListener("mousedown", handleMenuDismiss);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleMenuDismiss);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showFlowLayoutMenu, showActionsMenu]);
  useEffect(() => {
    if (view !== "flowchart" && showFlowLayoutMenu) {
      setShowFlowLayoutMenu(false);
    }
    setShowActionsMenu(false);
  }, [view, showFlowLayoutMenu]);
  useEffect(() => {
    const handleBeforePrint = () => flushSync(() => setIsPrinting(true));
    const handleAfterPrint = () => flushSync(() => setIsPrinting(false));
    const mql = window.matchMedia("print");
    const mqlListener = (e) => flushSync(() => setIsPrinting(e.matches));
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    if (mql.addEventListener) mql.addEventListener("change", mqlListener);
    else mql.addListener(mqlListener);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      if (mql.removeEventListener) mql.removeEventListener("change", mqlListener);
      else mql.removeListener(mqlListener);
    };
  }, []);
  useEffect(() => {
    const syncOnline = () => {
      setIsOnline(navigator.onLine);
      setSyncSummary(getSyncSummary());
    };
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);
  useEffect(() => {
    const initLocal = async () => {
      const projects = await listWorkspaces();
      setSavedProjects(projects);
      const latestId = getLastWorkspaceId();
      const latest = latestId && await loadWorkspace(latestId) || projects[0] || await getLatestWorkspace();
      if (latest?.name) setProjectName(latest.name);
      if (latest?.id) setCurrentWorkspaceId(latest.id);
      recordAuditEvent("workspace_bootstrap", { hasLatestWorkspace: Boolean(latest?.id), savedWorkspaceCount: projects.length });
      setBootChecks({
        offlineModeActive: "ServiceWorker" in navigator,
        cloudSyncUnavailable: !navigator.onLine
      });
    };
    initLocal();
  }, []);
  const handleSaveWorkspace = useCallback(async () => {
    if (!projectName.trim()) return false;
    setIsSaving(true);
    try {
      const data = toWorkspaceSavePayload({
        projectName,
        nodes,
        instrumentList,
        flowNodes,
        flowEdges,
        flowPz: flowPzRef.current,
        treeScale: treeScaleRef.current,
        printOrientation,
        gridCols,
        gridRows,
        tracts,
        contacts,
        ownershipInterests,
        contactLogs,
        deskMaps,
        activeDeskMapId,
        appId
      });
      const savedWorkspace = await saveWorkspace(data, currentWorkspaceId);
      setCurrentWorkspaceId(savedWorkspace.id);
      const projects = await listWorkspaces();
      setSavedProjects(projects);
      recordAuditEvent("workspace_saved", { workspaceId: savedWorkspace.id, workspaceName: data.name });
      return true;
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
    return false;
  }, [
    projectName,
    nodes,
    instrumentList,
    flowNodes,
    flowEdges,
    printOrientation,
    gridCols,
    gridRows,
    tracts,
    contacts,
    ownershipInterests,
    contactLogs,
    deskMaps,
    activeDeskMapId,
    currentWorkspaceId
  ]);
  useEffect(() => {
    if (!workspaceLoaded || showHome) return;
    const timer = setTimeout(() => {
      handleSaveWorkspace();
    }, 2e3);
    return () => clearTimeout(timer);
  }, [
    nodes,
    instrumentList,
    flowNodes,
    flowEdges,
    printOrientation,
    gridCols,
    gridRows,
    tracts,
    contacts,
    ownershipInterests,
    contactLogs,
    deskMaps,
    activeDeskMapId,
    projectName,
    workspaceLoaded,
    currentWorkspaceId,
    showHome,
    handleSaveWorkspace
  ]);
  const handleLoadWorkspace = (p, closeModal = true) => {
    const hydrated = fromStoredWorkspace(p, {
      makeId,
      defaultRoot,
      defaultViewport,
      defaultFlowViewport,
      normalizeFlowNodeGroups
    });
    if (hydrated.instrumentList) setInstrumentList(hydrated.instrumentList);
    if (hydrated.flowNodes) setFlowNodes(hydrated.flowNodes);
    if (hydrated.flowEdges) setFlowEdges(hydrated.flowEdges);
    if (hydrated.flowPz) setFlowPz(hydrated.flowPz);
    if (hydrated.treeScale) setTreeScale(hydrated.treeScale);
    if (hydrated.printOrientation) setPrintOrientation(hydrated.printOrientation);
    if (hydrated.gridCols) setGridCols(hydrated.gridCols);
    if (hydrated.gridRows) setGridRows(hydrated.gridRows);
    setTracts(hydrated.tracts);
    setContacts(hydrated.contacts);
    setOwnershipInterests(hydrated.ownershipInterests);
    setContactLogs(hydrated.contactLogs);
    setSelectedContactId(hydrated.selectedContactId);
    setDeskMaps(hydrated.deskMaps);
    setActiveDeskMapId(hydrated.activeDeskMapId);
    setNodes(hydrated.nodes);
    setPz(hydrated.pz);
    setProjectName(hydrated.projectName);
    setCurrentWorkspaceId(hydrated.workspaceId);
    setWorkspaceLoaded(true);
    setShowHome(false);
    if (closeModal) setShowCloudModal(false);
    recordAuditEvent("workspace_loaded", { workspaceId: hydrated.workspaceId, workspaceName: hydrated.projectName });
  };
  const handleEnterNewWorkspace = async () => {
    const freshWorkspaceId = crypto.randomUUID ? crypto.randomUUID() : makeId();
    const freshNode = { ...defaultRoot };
    const freshDeskMap = {
      id: makeId(),
      name: "Unit Tract 1",
      code: "TRACT-1",
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
    setPrintOrientation("landscape");
    setGridCols(defaultFlowGrid.cols);
    setGridRows(defaultFlowGrid.rows);
    setTracts([]);
    setContacts([]);
    setOwnershipInterests([]);
    setContactLogs([]);
    setSelectedContactId(null);
    const initialPayload = {
      name: "My Workspace",
      nodes: [{ ...freshNode }],
      instrumentList,
      flowNodes: [],
      flowEdges: [],
      flowPz: { ...defaultFlowViewport },
      treeScale: 1,
      printOrientation: "landscape",
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
      const savedWorkspace = await saveWorkspace(initialPayload, freshWorkspaceId);
      const projects = await listWorkspaces();
      setSavedProjects(projects);
      recordAuditEvent("workspace_created", { workspaceId: savedWorkspace.id, workspaceName: savedWorkspace.name || "My Workspace" });
    } catch (e) {
      console.error(e);
      window.alert("Unable to create a new workspace in local storage. Please try again.");
    }
    setCurrentWorkspaceId(freshWorkspaceId);
    setProjectName("My Workspace");
    setWorkspaceLoaded(true);
    setShowHome(false);
  };
  const handleClearFlowchart = () => {
    if (!window.confirm("Clear all flowchart nodes, edges, and layout settings? This cannot be undone.")) return;
    setFlowNodes([]);
    setFlowEdges([]);
    setSelectedFlowNode(null);
    setConnectingStart(null);
    setFlowPz({ ...defaultFlowViewport });
    setTreeScale(1);
    setGridCols(defaultFlowGrid.cols);
    setGridRows(defaultFlowGrid.rows);
    setShowActionsMenu(false);
    recordAuditEvent("flowchart_cleared", { previousNodeCount: flowNodes.length, previousEdgeCount: flowEdges.length });
  };
  const handleDocSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setForm((prev) => ({ ...prev, docData: evt.target.result, docNo: file.name.split(".")[0] }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const formatFraction = (num) => isNaN(num) || num === null || num === void 0 ? "0.000000000" : Number(num).toFixed(9);
  const formatConveyanceFraction = (node) => {
    if (!node || node.type !== "conveyance" || node.conveyanceMode !== "fraction") return "";
    const numerator = Number(node.numerator || 0);
    const denominator = Number(node.denominator || 0);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "";
    const basisLabel = node.splitBasis === "initial" ? "of predecessor grant" : node.splitBasis === "remaining" ? "of predecessor remaining" : "of whole tract";
    return `${numerator}/${denominator} ${basisLabel}`;
  };
  const calcShare = useMemo(() => {
    if (modalMode !== "convey" && modalMode !== "attach") return 0;
    const parentIdToUse = modalMode === "attach" ? attachParentId : activeNode?.id;
    const parent = nodeById[parentIdToUse];
    return calculateShare({ form, parent });
  }, [form, nodeById, modalMode, activeNode, attachParentId]);
  const attachImpact = useMemo(() => {
    if (modalMode !== "attach" || attachType !== "conveyance" || !activeNode) return null;
    const destination = nodeById[attachParentId];
    if (!destination) return { valid: false, reason: "Select a valid destination record." };
    const descendants = collectDescendantIds(nodes, activeNode.id);
    if (attachParentId === activeNode.id || descendants.has(attachParentId)) {
      return { valid: false, reason: "Cannot attach to itself or a descendant." };
    }
    const oldRootFraction = Math.max(activeNode.fraction || 0, FRACTION_EPSILON);
    const newRootFraction = clampFraction(calcShare);
    const scaleFactor = newRootFraction / oldRootFraction;
    return {
      valid: true,
      destinationName: destination.grantee || destination.instrument || "Selected destination",
      destinationBefore: destination.fraction || 0,
      destinationAfter: clampFraction((destination.fraction || 0) - newRootFraction),
      rootBefore: activeNode.fraction || 0,
      rootAfter: newRootFraction,
      scaleFactor,
      descendantCount: descendants.size
    };
  }, [modalMode, attachType, activeNode, nodes, attachParentId, calcShare, nodeById]);
  const rebalanceImpact = useMemo(() => {
    if (modalMode !== "rebalance" || !activeNode) return null;
    const parent = nodeById[activeNode.parentId];
    const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
    const newInitialFraction = clampFraction(form.initialFraction);
    const scaleFactor = newInitialFraction / oldInitialFraction;
    const descendants = collectDescendantIds(nodes, activeNode.id);
    return {
      oldInitialFraction,
      newInitialFraction,
      scaleFactor,
      descendantCount: descendants.size,
      parentBefore: parent?.fraction || 0,
      parentAfter: parent ? clampFraction((parent.fraction || 0) + oldInitialFraction - newInitialFraction) : null
    };
  }, [modalMode, activeNode, nodes, form.initialFraction, nodeById]);
  const precedeImpact = useMemo(() => {
    if (modalMode !== "precede" || !activeNode) return null;
    const parent = nodeById[activeNode.parentId];
    const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
    const newInitialFraction = clampFraction(form.initialFraction);
    const scaleFactor = newInitialFraction / oldInitialFraction;
    const descendants = collectDescendantIds(nodes, activeNode.id);
    return {
      oldInitialFraction,
      newInitialFraction,
      scaleFactor,
      descendantCount: descendants.size,
      parentBefore: parent?.fraction || 0,
      parentAfter: parent ? clampFraction((parent.fraction || 0) + oldInitialFraction - newInitialFraction) : null,
      predecessorRetained: clampFraction(newInitialFraction - (activeNode.initialFraction || 0))
    };
  }, [modalMode, activeNode, nodes, form.initialFraction, nodeById]);
  const openEdit = (node) => {
    if (!instrumentList.includes(node.instrument)) setInstrumentList((prev) => [...prev, node.instrument]);
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("edit");
    setActiveNode(node);
    setForm({ ...node, conveyanceMode: "fraction", splitBasis: "initial", numerator: 1, denominator: 2, manualAmount: 0 });
    showModalAndCaptureTrigger();
  };
  const openConvey = (node) => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("convey");
    setActiveNode(node);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    setForm({
      instrument: "Warranty Deed",
      vol: "",
      page: "",
      docNo: "",
      fileDate: today,
      date: today,
      type: "conveyance",
      grantor: node.grantee,
      grantee: "",
      landDesc: node.landDesc,
      remarks: "",
      conveyanceMode: lastMathProps.conveyanceMode,
      splitBasis: lastMathProps.splitBasis,
      numerator: lastMathProps.numerator,
      denominator: lastMathProps.denominator,
      manualAmount: lastMathProps.manualAmount,
      docData: "",
      isDeceased: false,
      obituary: "",
      graveyardLink: ""
    });
    showModalAndCaptureTrigger();
  };
  const openRelated = (node) => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("add_related");
    setActiveNode(node);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    setForm({
      instrument: "Affidavit of Heirship",
      vol: "",
      page: "",
      docNo: "",
      fileDate: today,
      date: today,
      type: "related",
      grantor: "",
      grantee: node.grantee,
      landDesc: node.landDesc,
      remarks: "Related to branch",
      conveyanceMode: "fraction",
      splitBasis: "initial",
      numerator: 1,
      denominator: 2,
      manualAmount: 0,
      docData: "",
      isDeceased: false,
      obituary: "",
      graveyardLink: ""
    });
    showModalAndCaptureTrigger();
  };
  const openPrecede = (node) => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("precede");
    setActiveNode(node);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    setForm({
      instrument: "Warranty Deed",
      vol: "",
      page: "",
      docNo: "",
      fileDate: node.fileDate || today,
      date: node.date || today,
      type: "conveyance",
      grantor: "",
      grantee: node.grantor || "",
      landDesc: node.landDesc,
      remarks: "Predecessor to " + node.instrument,
      estateType: node.estateType || "Minerals",
      conveyanceMode: "fraction",
      splitBasis: "initial",
      numerator: 1,
      denominator: 2,
      manualAmount: 0,
      docData: "",
      isDeceased: false,
      obituary: "",
      graveyardLink: "",
      initialFraction: node.initialFraction || node.fraction
    });
    showModalAndCaptureTrigger();
  };
  const openRebalance = (node) => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("rebalance");
    setActiveNode(node);
    setForm({
      ...node,
      initialFraction: node.initialFraction || node.fraction,
      remarks: (node.remarks ? node.remarks + " " : "") + "[Branch rebalance]"
    });
    showModalAndCaptureTrigger();
  };
  const openNewChain = () => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("add_chain");
    setActiveNode(null);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    setForm({
      instrument: "Original Grant",
      vol: "",
      page: "",
      docNo: "",
      fileDate: today,
      date: today,
      type: "conveyance",
      grantor: "Unknown / Sovereign",
      grantee: "",
      landDesc: "",
      remarks: "Independent Title Chain",
      estateType: "Minerals",
      conveyanceMode: "fraction",
      splitBasis: "whole",
      numerator: 1,
      denominator: 1,
      manualAmount: 0,
      docData: "",
      isDeceased: false,
      obituary: "",
      graveyardLink: "",
      initialFraction: 1,
      fraction: 1
    });
    showModalAndCaptureTrigger();
  };
  const openAddUnlinked = () => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("add_unlinked");
    setActiveNode(null);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    setForm({
      instrument: "Warranty Deed",
      vol: "",
      page: "",
      docNo: "",
      fileDate: today,
      date: today,
      type: "conveyance",
      grantor: "",
      grantee: "",
      landDesc: "",
      remarks: "Parked document pending research",
      estateType: "Minerals",
      conveyanceMode: "fraction",
      splitBasis: "initial",
      numerator: 1,
      denominator: 2,
      manualAmount: 0,
      docData: "",
      isDeceased: false,
      obituary: "",
      graveyardLink: ""
    });
    showModalAndCaptureTrigger();
  };
  const openAttach = (node) => {
    setIsAddingInst(false);
    setShowGranteeList(false);
    setModalMode("attach");
    setActiveNode(node);
    setAttachParentId(nodes.filter((n) => n.id !== node.id && n.parentId !== "unlinked")[0]?.id || "root");
    setAttachType("conveyance");
    setForm({ ...node, estateType: node.estateType || "Minerals", conveyanceMode: lastMathProps.conveyanceMode, splitBasis: lastMathProps.splitBasis, numerator: lastMathProps.numerator, denominator: lastMathProps.denominator, manualAmount: lastMathProps.manualAmount });
    showModalAndCaptureTrigger();
  };
  const toggleDeceased = (node) => updateActiveDeskMapNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, isDeceased: !n.isDeceased } : n));
  const commitBranchRebalance = (baseNodes, options) => {
    const { node, newInitialFraction, includeFormFields = false } = options;
    const safeFormFields = includeFormFields ? (() => {
      const {
        fraction: _ignoredFraction,
        initialFraction: _ignoredInitialFraction,
        parentId: _ignoredParentId,
        ...rest
      } = form;
      return rest;
    })() : null;
    const executed = executeRebalance({
      allNodes: baseNodes,
      nodeId: node.id,
      parentId: node.parentId,
      newInitialFraction,
      formFields: safeFormFields
    });
    if (!executed.ok) return null;
    return {
      updatedNodes: executed.data,
      oldInitialFraction: executed.audit?.oldInitialFraction,
      newInitialFraction: executed.audit?.newInitialFraction,
      scaleFactor: executed.audit?.scaleFactor,
      affectedCount: executed.audit?.affectedCount
    };
  };
  const ensureValidOwnershipGraph = (candidateNodes, actionLabel) => {
    const validation = validateOwnershipGraph(candidateNodes);
    if (validation.valid) return true;
    const firstIssue = validation.issues[0];
    const detail = firstIssue?.message || `${actionLabel} produced an invalid ownership graph.`;
    window.alert(`Unable to complete ${actionLabel}: ${detail}`);
    return false;
  };
  const handleCommit = () => {
    if (modalMode === "convey" || modalMode === "attach") {
      setLastMathProps({ conveyanceMode: form.conveyanceMode, splitBasis: form.splitBasis, numerator: form.numerator, denominator: form.denominator, manualAmount: form.manualAmount });
    }
    if (modalMode === "edit") {
      const isRebalanceEdit = activeNode && activeNode.type === "conveyance" && activeNode.parentId !== "unlinked" && Number.isFinite(form.initialFraction) && Math.abs(clampFraction(form.initialFraction) - (activeNode.initialFraction || 0)) > FRACTION_EPSILON;
      if (!isRebalanceEdit) {
        updateActiveDeskMapNodes((prev) => prev.map((n) => n.id === activeNode.id ? { ...n, ...form } : n));
      } else {
        const shouldContinue = window.confirm("Changing initial fraction will recalculate this branch and descendants. Continue?");
        if (!shouldContinue) return;
        const result = commitBranchRebalance(nodes, {
          node: activeNode,
          newInitialFraction: form.initialFraction,
          includeFormFields: true
        });
        if (!result) return;
        if (!ensureValidOwnershipGraph(result.updatedNodes, "rebalance edit")) return;
        updateActiveDeskMapNodes(result.updatedNodes);
        recordBranchRecalculationAudit({
          action: "edit_rebalance",
          nodeId: activeNode.id,
          oldInitialFraction: result.oldInitialFraction,
          newInitialFraction: result.newInitialFraction,
          scaleFactor: result.scaleFactor,
          affectedCount: result.affectedCount
        });
      }
    } else if (modalMode === "convey") {
      const newId = makeId();
      const conveyResult = executeConveyance({ allNodes: nodes, parentId: activeNode.id, newNodeId: newId, share: calcShare, form });
      if (!conveyResult.ok) {
        window.alert(`Unable to complete conveyance: ${conveyResult.error?.message || "Unknown error"}`);
        return;
      }
      updateActiveDeskMapNodes(conveyResult.data);
    } else if (modalMode === "precede") {
      const newId = makeId();
      const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
      const newInitialFraction = clampFraction(form.initialFraction);
      if (Math.abs(newInitialFraction - oldInitialFraction) > FRACTION_EPSILON) {
        const shouldContinue = window.confirm("This predecessor change will recalculate every descendant in this branch. Continue?");
        if (!shouldContinue) return;
      }
      const precedeResult = executePredecessorInsert({
        allNodes: nodes,
        activeNodeId: activeNode.id,
        activeNodeParentId: activeNode.parentId,
        newPredecessorId: newId,
        form,
        newInitialFraction: form.initialFraction
      });
      if (!precedeResult.ok) {
        window.alert(`Unable to complete predecessor insertion: ${precedeResult.error?.message || "Unknown error"}`);
        return;
      }
      updateActiveDeskMapNodes(precedeResult.data);
      recordBranchRecalculationAudit({
        action: "precede",
        nodeId: activeNode.id,
        predecessorId: newId,
        oldInitialFraction: precedeResult.audit?.oldInitialFraction,
        newInitialFraction: precedeResult.audit?.newInitialFraction,
        scaleFactor: precedeResult.audit?.scaleFactor,
        affectedCount: precedeResult.audit?.affectedCount
      });
    } else if (modalMode === "rebalance") {
      const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
      const newInitialFraction = clampFraction(form.initialFraction);
      if (Math.abs(newInitialFraction - oldInitialFraction) > FRACTION_EPSILON) {
        const shouldContinue = window.confirm("This rebalance will recalculate every descendant in this branch. Continue?");
        if (!shouldContinue) return;
      }
      const result = commitBranchRebalance(nodes, {
        node: activeNode,
        newInitialFraction: form.initialFraction,
        includeFormFields: false
      });
      if (!result) return;
      if (!ensureValidOwnershipGraph(result.updatedNodes, "rebalance")) return;
      updateActiveDeskMapNodes(result.updatedNodes);
      recordBranchRecalculationAudit({
        action: "rebalance",
        nodeId: activeNode.id,
        oldInitialFraction: result.oldInitialFraction,
        newInitialFraction: result.newInitialFraction,
        scaleFactor: result.scaleFactor,
        affectedCount: result.affectedCount
      });
    } else if (modalMode === "add_chain") {
      const newId = makeId();
      const available = Math.max(0, 1 - totalRootOwnership);
      const requested = clampFraction(form.initialFraction);
      if (requested - available > FRACTION_EPSILON) {
        window.alert(`Only ${formatFraction(available)} ownership capacity remains in this map. Reduce the initial granted share to ${formatFraction(available)} or less.`);
        return;
      }
      updateActiveDeskMapNodes((prev) => [...prev, { ...form, id: newId, type: "conveyance", parentId: null }]);
    } else if (modalMode === "add_related") {
      const newId = makeId();
      updateActiveDeskMapNodes((prev) => [...prev, { ...form, id: newId, type: "related", fraction: 0, initialFraction: 0, parentId: activeNode.id }]);
    } else if (modalMode === "add_unlinked") {
      const newId = makeId();
      updateActiveDeskMapNodes((prev) => [...prev, { ...form, id: newId, type: "conveyance", fraction: 0, initialFraction: 0, parentId: "unlinked" }]);
    } else if (modalMode === "attach") {
      if (attachType === "conveyance") {
        const descendants = collectDescendantIds(nodes, activeNode.id);
        if (attachParentId === activeNode.id || descendants.has(attachParentId)) {
          window.alert("Cannot attach a record to itself or one of its descendants.");
          return;
        }
        const shouldContinue = window.confirm("Attaching this conveyance will recalculate ownership for this branch. Continue?");
        if (!shouldContinue) return;
        const destinationNode = nodeById[attachParentId];
        const attachResult = executeAttachConveyance({ allNodes: nodes, activeNodeId: activeNode.id, attachParentId, calcShare, form });
        if (!attachResult.ok) {
          window.alert(`Unable to complete attach conveyance: ${attachResult.error?.message || "Unknown error"}`);
          return;
        }
        updateActiveDeskMapNodes(attachResult.data);
        recordBranchRecalculationAudit({
          action: "attach_conveyance",
          nodeId: activeNode.id,
          destinationId: attachParentId,
          destinationName: destinationNode?.grantee || destinationNode?.instrument || "",
          oldRootFraction: attachResult.audit?.oldRootFraction,
          newRootFraction: attachResult.audit?.newRootFraction,
          scaleFactor: attachResult.audit?.scaleFactor,
          affectedCount: attachResult.audit?.affectedCount
        });
      } else {
        updateActiveDeskMapNodes((prev) => prev.map((n) => n.id === activeNode.id ? { ...form, parentId: attachParentId, type: "related", fraction: 0, initialFraction: 0 } : n));
      }
    }
    setShowModal(false);
  };
  const requestDeleteRecord = (node) => {
    setConfirmAction({
      title: "Delete Title Record",
      message: `Are you sure you want to permanently delete "${node.instrument}" to ${node.grantee}? Any attached child branches will be safely moved to the Runsheet Parking Lot.`,
      actionText: "Delete Record",
      onConfirm: () => {
        updateActiveDeskMapNodes((prev) => prev.map((x) => {
          if (x.id === node.id) return null;
          if (x.parentId === node.id) return { ...x, parentId: "unlinked", remarks: (x.remarks ? x.remarks + " " : "") + "[Orphaned from deleted parent]" };
          return x;
        }).filter(Boolean));
      }
    });
  };
  const escapeCSV = (val) => {
    if (val === null || val === void 0) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };
  const exportCSV = () => {
    const headers = ["Documents Hyperlinked", "Instrument", "Order by Date", "Image Path", "Vol", "Page", "Inst No.", "File Date", "Inst Date", "Grantor / Assignor", "Grantee / Assignee", "Land Desc.", "Remarks", "INTERNAL_REMAINING_FRACTION", "INTERNAL_INITIAL_FRACTION", "INTERNAL_ID", "INTERNAL_PID", "INTERNAL_DOC", "INTERNAL_TYPE", "INTERNAL_DECEASED", "INTERNAL_OBITUARY", "INTERNAL_GRAVEYARD_LINK", "INTERNAL_TRACTS", "INTERNAL_CONTACTS", "INTERNAL_INTERESTS", "INTERNAL_CONTACT_LOGS", "INTERNAL_DESKMAPS", "INTERNAL_ACTIVE_DESKMAP_ID"];
    const rows = (nodes.length ? nodes : [{
      instrument: "",
      vol: "",
      page: "",
      docNo: "",
      fileDate: "",
      date: "",
      grantor: "",
      grantee: "",
      landDesc: "",
      remarks: "",
      fraction: 0,
      initialFraction: 0,
      id: makeId(),
      parentId: "NULL",
      docData: "",
      type: "conveyance",
      isDeceased: false,
      obituary: "",
      graveyardLink: ""
    }]).map((n, i) => [
      i + 1,
      n.instrument,
      i + 1,
      `TORS_Documents\\${n.docNo}.pdf`,
      n.vol,
      n.page,
      n.docNo,
      n.fileDate,
      n.date,
      n.grantor,
      n.grantee,
      n.landDesc,
      n.remarks,
      n.fraction,
      n.initialFraction || n.fraction,
      n.id,
      n.parentId || "NULL",
      n.docData || "",
      n.type || "conveyance",
      n.isDeceased ? "true" : "false",
      n.obituary || "",
      n.graveyardLink || "",
      i === 0 ? JSON.stringify(tracts) : "",
      i === 0 ? JSON.stringify(contacts) : "",
      i === 0 ? JSON.stringify(ownershipInterests) : "",
      i === 0 ? JSON.stringify(contactLogs) : "",
      i === 0 ? JSON.stringify(deskMaps) : "",
      i === 0 ? activeDeskMapId : ""
    ]);
    const content = "\uFEFF" + headers.join(",") + "\n" + rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LANDroid_Data_Save_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const exportToRunsheet = () => {
    const csvHeader = `Documents Hyperlinked to TORS_Documents Folder,Instrument,Order by Date,Image Path,Vol,Page,"Instrument No.
San Jacinto",File Date,Inst./Eff. Date,Assignor / Lessor,Assignee / Lessee,Land Desc.,Remarks`;
    const sortedNodes = [...nodes].sort((a, b) => new Date(a.date) - new Date(b.date));
    const rows = sortedNodes.map((n, i) => [
      "",
      escapeCSV(n.instrument),
      "",
      "",
      escapeCSV(n.vol),
      escapeCSV(n.page),
      escapeCSV(n.docNo),
      escapeCSV(n.fileDate),
      escapeCSV(n.date),
      escapeCSV(n.grantor),
      escapeCSV(n.grantee),
      escapeCSV(n.landDesc),
      escapeCSV(n.remarks)
    ]);
    const content = "\uFEFF" + csvHeader + "\n" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Runsheet_Export_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parseJsonField = (row, field) => {
          const raw = row[field];
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        };
        const firstRow = results.data[0] || {};
        const requiredHeaders = [
          "INTERNAL_ID",
          "INTERNAL_PID",
          "INTERNAL_TYPE",
          "INTERNAL_REMAINING_FRACTION",
          "INTERNAL_INITIAL_FRACTION",
          "INTERNAL_DESKMAPS"
        ];
        const missingHeaders = requiredHeaders.filter((header) => !(header in firstRow));
        if (missingHeaders.length) {
          window.alert(`Import failed: this CSV is not in the current LANDroid workspace format. Missing columns: ${missingHeaders.join(", ")}`);
          return;
        }
        const importedDeskMaps = parseJsonField(firstRow, "INTERNAL_DESKMAPS");
        if (!Array.isArray(importedDeskMaps) || !importedDeskMaps.length) {
          window.alert("Import failed: INTERNAL_DESKMAPS payload is missing or invalid.");
          return;
        }
        const parsedRows = results.data.map((row) => {
          return {
            originalId: row["INTERNAL_ID"] || null,
            instrument: row["Instrument"] || "",
            vol: row["Vol"] || "",
            page: row["Page"] || "",
            docNo: row["Inst No."] || "",
            fileDate: row["File Date"] || "",
            date: row["Inst Date"] || "",
            grantor: row["Grantor / Assignor"] || "",
            grantee: row["Grantee / Assignee"] || "",
            landDesc: row["Land Desc."] || "",
            remarks: row["Remarks"] || "",
            fraction: parseFloat(row["INTERNAL_REMAINING_FRACTION"] || 0),
            initialFraction: parseFloat(row["INTERNAL_INITIAL_FRACTION"] || 0),
            parentId: row["INTERNAL_PID"] === "NULL" ? null : row["INTERNAL_PID"],
            docData: row["INTERNAL_DOC"] ? row["INTERNAL_DOC"].replace(/(^"|"$)/g, "") : "",
            type: row["INTERNAL_TYPE"] || "conveyance",
            isDeceased: row["INTERNAL_DECEASED"] === "true",
            obituary: row["INTERNAL_OBITUARY"] ? row["INTERNAL_OBITUARY"].replace(/(^"|"$)/g, "") : "",
            graveyardLink: row["INTERNAL_GRAVEYARD_LINK"] ? row["INTERNAL_GRAVEYARD_LINK"].replace(/(^"|"$)/g, "") : ""
          };
        });
        const existingIds = /* @__PURE__ */ new Set([
          ...nodes.map((n) => n.id),
          ...deskMaps.flatMap((map) => (map.nodes || []).map((n) => n.id))
        ]);
        const usedIds = new Set(existingIds);
        const idRemap = {};
        const newNodes = parsedRows.map((node) => {
          const sourceId = (node.originalId || "").trim();
          let nextId = sourceId && !usedIds.has(sourceId) ? sourceId : makeId();
          while (usedIds.has(nextId)) nextId = makeId();
          usedIds.add(nextId);
          if (sourceId) idRemap[sourceId] = nextId;
          return { ...node, id: nextId };
        }).map((node) => {
          const rawParentId = node.parentId;
          let parentId = rawParentId;
          if (typeof rawParentId === "string" && rawParentId && rawParentId !== "unlinked") {
            parentId = idRemap[rawParentId] || (usedIds.has(rawParentId) ? rawParentId : "unlinked");
          }
          const cleanedParent = parentId === "NULL" ? null : parentId;
          const { originalId, ...rest } = node;
          return { ...rest, parentId: cleanedParent };
        });
        if (newNodes.length) {
          const newInsts = [...new Set(newNodes.map((n) => n.instrument).filter(Boolean))];
          setInstrumentList((prev) => [.../* @__PURE__ */ new Set([...prev, ...newInsts])]);
          const importedActiveDeskMapId = firstRow["INTERNAL_ACTIVE_DESKMAP_ID"] || "";
          setNodes(newNodes);
          setTracts(parseJsonField(firstRow, "INTERNAL_TRACTS"));
          const importedContacts = parseJsonField(firstRow, "INTERNAL_CONTACTS");
          setContacts(importedContacts);
          setOwnershipInterests(parseJsonField(firstRow, "INTERNAL_INTERESTS"));
          setContactLogs(parseJsonField(firstRow, "INTERNAL_CONTACT_LOGS"));
          setDeskMaps(importedDeskMaps);
          const nextDeskMapId = importedDeskMaps.some((map) => map.id === importedActiveDeskMapId) ? importedActiveDeskMapId : importedDeskMaps[0].id;
          setActiveDeskMapId(nextDeskMapId);
          const activeMap = importedDeskMaps.find((map) => map.id === nextDeskMapId) || importedDeskMaps[0];
          setNodes(activeMap.nodes || newNodes);
          setPz(activeMap.pz || { ...defaultViewport });
          setSelectedContactId(importedContacts[0] && importedContacts[0].id || null);
          window.alert(`Import complete.
Records imported: ${newNodes.length}
Mode: replace
Maps updated from embedded workspace payload.`);
        }
      },
      error: (error) => console.error("Error parsing CSV:", error)
    });
    e.target.value = "";
  };
  const addTract = () => {
    if (!tractForm.code.trim()) return;
    const tractId = makeId();
    const tractCode = tractForm.code.trim();
    const tractName = tractForm.name.trim();
    setTracts((prev) => [...prev, {
      id: tractId,
      code: tractCode,
      name: tractName,
      acres: parseFloat(tractForm.acres) || 0,
      mapId: tractForm.mapId.trim()
    }]);
    const newDeskMap = createDeskMap({ name: tractName || tractCode, code: tractCode, tractId });
    setDeskMaps((prev) => [...prev, newDeskMap]);
    setActiveDeskMapId(newDeskMap.id);
    setTractForm({ code: "", name: "", acres: "", mapId: "" });
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
    setContacts((prev) => [...prev, newContact]);
    setSelectedContactId(newContact.id);
    setContactForm({ name: "", role: "", phone: "", email: "" });
  };
  const addInterest = () => {
    if (!interestForm.contactId || !interestForm.tractId || !interestForm.interestValue) return;
    const parsedInterest = parseFloat(interestForm.interestValue);
    if (Number.isNaN(parsedInterest) || parsedInterest < 0 || parsedInterest > 1) {
      window.alert("Interest must be a decimal between 0 and 1.");
      return;
    }
    setOwnershipInterests((prev) => [...prev, {
      id: makeId(),
      contactId: interestForm.contactId,
      tractId: interestForm.tractId,
      interestType: interestForm.interestType,
      interestValue: parsedInterest,
      status: interestForm.status
    }]);
    setInterestForm((prev) => ({ ...prev, interestValue: "" }));
  };
  const addContactLog = () => {
    if (!logForm.contactId || !logForm.outcome.trim()) return;
    setContactLogs((prev) => [...prev, {
      id: makeId(),
      contactId: logForm.contactId,
      tractId: logForm.tractId || null,
      method: logForm.method,
      outcome: logForm.outcome.trim(),
      nextFollowupAt: logForm.nextFollowupAt || "",
      notes: logForm.notes.trim(),
      contactAt: (/* @__PURE__ */ new Date()).toISOString()
    }]);
    setLogForm((prev) => ({ ...prev, outcome: "", notes: "", nextFollowupAt: "" }));
  };
  const removeTract = (tractId) => {
    setTracts((prev) => prev.filter((t) => t.id !== tractId));
    setOwnershipInterests((prev) => prev.filter((i) => i.tractId !== tractId));
    setContactLogs((prev) => prev.filter((l) => l.tractId !== tractId));
    setDeskMaps((prev) => {
      const filtered = prev.filter((map) => map.tractId !== tractId);
      if (filtered.length) return filtered;
      return [createDeskMap()];
    });
  };
  const removeContact = (contactId) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setOwnershipInterests((prev) => prev.filter((i) => i.contactId !== contactId));
    setContactLogs((prev) => prev.filter((l) => l.contactId !== contactId));
    setSelectedContactId((prev) => prev === contactId ? null : prev);
  };
  const removeInterest = (interestId) => {
    setOwnershipInterests((prev) => prev.filter((i) => i.id !== interestId));
  };
  const removeContactLog = (logId) => {
    setContactLogs((prev) => prev.filter((l) => l.id !== logId));
  };
  const buildTree = (pId = null) => {
    const children = nodes.filter((n) => n.parentId === pId && n.type !== "related");
    return children.map((n) => ({ ...n, children: buildTree(n.id) }));
  };
  const tree = useMemo(() => buildTree(), [nodes]);
  const simplifyZoomSubtrees = isZooming && nodes.length > 180;
  const relatedByParentId = useMemo(() => {
    const grouped = {};
    nodes.forEach((node) => {
      if (node.type !== "related" || node.parentId == null) return;
      if (!grouped[node.parentId]) grouped[node.parentId] = [];
      grouped[node.parentId].push(node);
    });
    return grouped;
  }, [nodes]);
  useEffect(() => () => {
    if (wheelFrameRef.current !== null) {
      cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
    if (zoomIdleTimerRef.current) {
      clearTimeout(zoomIdleTimerRef.current);
      zoomIdleTimerRef.current = null;
    }
    if (zoomEndTimerRef.current) {
      clearTimeout(zoomEndTimerRef.current);
      zoomEndTimerRef.current = null;
    }
  }, []);
  const normalizeViewport = (viewport) => {
    const safeScale = Number.isFinite(Number(viewport?.scale)) ? Number(viewport.scale) : defaultViewport.scale;
    const safeX = Number.isFinite(Number(viewport?.x)) ? Number(viewport.x) : defaultViewport.x;
    const safeY = Number.isFinite(Number(viewport?.y)) ? Number(viewport.y) : defaultViewport.y;
    return {
      x: safeX,
      y: safeY,
      scale: Math.min(Math.max(0.1, safeScale), 5)
    };
  };
  const applyDeskMapTransform = (viewport) => {
    const viewportEl = chartViewportRef.current;
    if (!viewportEl) return;
    const safeViewport = normalizeViewport(viewport);
    viewportEl.style.transform = `translate3d(${safeViewport.x}px, ${safeViewport.y}px, 0) scale(${safeViewport.scale})`;
  };
  useEffect(() => {
    const safeViewport = normalizeViewport(pz);
    livePzRef.current = safeViewport;
    applyDeskMapTransform(safeViewport);
  }, [pz]);
  const handlePointerDown = (e) => {
    if (e.button !== 0 || e.target.closest("button") || e.target.closest(".treenode-body")) return;
    isDragging.current = true;
    const currentPz = normalizeViewport(livePzRef.current);
    dragStart.current = { x: e.clientX - currentPz.x, y: e.clientY - currentPz.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    chartPanPointRef.current = { x: e.clientX, y: e.clientY };
    if (chartPanFrameRef.current !== null) return;
    chartPanFrameRef.current = requestAnimationFrame(() => {
      chartPanFrameRef.current = null;
      const point = chartPanPointRef.current;
      if (!point) return;
      const nextViewport = normalizeViewport({ ...livePzRef.current, x: point.x - dragStart.current.x, y: point.y - dragStart.current.y });
      livePzRef.current = nextViewport;
      applyDeskMapTransform(nextViewport);
    });
  };
  const handlePointerUp = (e) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (chartPanFrameRef.current !== null) {
      cancelAnimationFrame(chartPanFrameRef.current);
      chartPanFrameRef.current = null;
    }
    chartPanPointRef.current = null;
    setPz(normalizeViewport(livePzRef.current));
  };
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    wheelPointerRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    wheelAccumulatedDeltaRef.current += e.deltaY;
    if (!isZooming) setIsZooming(true);
    if (zoomIdleTimerRef.current) clearTimeout(zoomIdleTimerRef.current);
    zoomIdleTimerRef.current = setTimeout(() => setPz(normalizeViewport(livePzRef.current)), 120);
    if (zoomEndTimerRef.current) clearTimeout(zoomEndTimerRef.current);
    zoomEndTimerRef.current = setTimeout(() => setIsZooming(false), 150);
    if (wheelFrameRef.current !== null) return;
    wheelFrameRef.current = requestAnimationFrame(() => {
      const totalDelta = wheelAccumulatedDeltaRef.current;
      wheelAccumulatedDeltaRef.current = 0;
      wheelFrameRef.current = null;
      const pointerX = wheelPointerRef.current.x;
      const pointerY = wheelPointerRef.current.y;
      const currentViewport = normalizeViewport(livePzRef.current);
      const zoomFactor = Math.exp(totalDelta * -1e-3);
      const nextScale = Math.min(Math.max(0.1, currentViewport.scale * zoomFactor), 5);
      if (nextScale === currentViewport.scale) return;
      const worldX = (pointerX - currentViewport.x) / currentViewport.scale;
      const worldY = (pointerY - currentViewport.y) / currentViewport.scale;
      const nextViewport = normalizeViewport({
        ...currentViewport,
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale
      });
      livePzRef.current = nextViewport;
      applyDeskMapTransform(nextViewport);
    });
  };
  const countTreeDescendants = (node) => {
    if (!node?.children?.length) return 0;
    return node.children.reduce((sum, child) => sum + 1 + countTreeDescendants(child), 0);
  };
  const toggleTreeBranchCollapse = (nodeId) => {
    updateActiveDeskMapNodes((prevNodes) => prevNodes.map((node) => node.id === nodeId ? { ...node, isCollapsed: !node.isCollapsed } : node));
  };
  const renderTreeNode = (n, depth = 0) => {
    const relatedDocs = relatedByParentId[n.id] || [];
    const isDeceased = n.isDeceased;
    const conveyanceFractionLabel = formatConveyanceFraction(n);
    const grantFractionDisplay = formatAsFraction(n.initialFraction || n.fraction);
    const remainingFractionDisplay = formatAsFraction(n.fraction);
    const hasChildren = n.children.length > 0;
    const isCollapsed = Boolean(n.isCollapsed);
    const hiddenDescendantCount = isCollapsed ? countTreeDescendants(n) : 0;
    const shouldSimplifyChildren = simplifyZoomSubtrees && depth >= 1 && hasChildren;
    const simplifiedHiddenCount = shouldSimplifyChildren ? countTreeDescendants(n) : 0;
    return /* @__PURE__ */ React.createElement("div", { key: n.id, className: "flex flex-col items-center relative animate-fade-in treenode" }, /* @__PURE__ */ React.createElement("div", { className: "z-10 group relative treenode-body" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        role: "button",
        tabIndex: 0,
        onClick: () => openEdit(n),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEdit(n);
          }
        },
        className: `p-4 border min-w-[260px] max-w-[300px] cursor-pointer transition-all duration-300 relative ${isDeceased ? isZooming ? "bg-teastain border-sepia text-sepia" : "bg-teastain border-sepia text-sepia ink-shadow" : isZooming ? "bg-parchment border-ink text-ink" : "bg-parchment border-ink text-ink ink-shadow ink-shadow-hover"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: `flex justify-between items-start mb-2 border-b pb-2 ${isDeceased ? "border-sepia/20" : "border-ink/20"}` }, /* @__PURE__ */ React.createElement("span", { className: "font-serif text-xs font-bold uppercase tracking-widest text-sepia" }, n.instrument), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 items-center" }, hasChildren && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            toggleTreeBranchCollapse(n.id);
          },
          title: isCollapsed ? "Expand branch" : "Collapse branch",
          className: `px-1.5 py-0.5 text-xs font-bold border rounded-sm transition-colors ${isDeceased ? "border-sepia/50 hover:bg-sepia/20" : "border-ink/40 hover:bg-ink/10"}`
        },
        isCollapsed ? "+" : "\u2212"
      ), n.docData && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
        e.stopPropagation();
        setViewerData(n.docData);
      }, title: "View Vault Document", className: `p-1 border border-transparent hover:border-current rounded-sm transition-colors text-stamp` }, /* @__PURE__ */ React.createElement(Icon, { name: "Eye", size: 16 })), !n.docData && n.hasDoc && /* @__PURE__ */ React.createElement("span", { className: `p-1 ${isDeceased ? "text-sepia/40" : "text-sepia/30"}`, title: "Document in Cloud Vault" }, /* @__PURE__ */ React.createElement(Icon, { name: "Cloud", size: 16 })), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
        e.stopPropagation();
        toggleDeceased(n);
      }, title: "Toggle Graveyard Protocol", className: `p-1 border border-transparent hover:border-current rounded-sm transition-colors ${isDeceased ? "text-sepia/80" : "text-sepia/30 hover:text-sepia"}` }, /* @__PURE__ */ React.createElement(Icon, { name: "Tombstone", size: 16 })))),
      /* @__PURE__ */ React.createElement("div", { className: "mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5" }, "Grantee / Assignee"), /* @__PURE__ */ React.createElement("div", { className: "font-display font-bold text-base leading-tight" }, n.grantee)),
      /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5" }, "Grantor / Assignor"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs truncate opacity-80" }, n.grantor)),
      conveyanceFractionLabel && /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5" }, "Conveyance"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs" }, conveyanceFractionLabel)),
      /* @__PURE__ */ React.createElement("div", { className: `flex flex-col border-t pt-2 font-mono ${isDeceased ? "border-sepia/20" : "border-ink/20"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-end mb-1 " }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] uppercase tracking-widest opacity-60" }, "Grant"), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold text-sepia" }, formatFraction(n.initialFraction || n.fraction)), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] opacity-70" }, grantFractionDisplay))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-end" }, /* @__PURE__ */ React.createElement("span", { className: `text-[10px] uppercase tracking-widest italic ${n.fraction < FRACTION_EPSILON ? "text-stamp font-bold" : "opacity-60"}` }, "Rem"), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: `text-xs italic ${n.fraction < FRACTION_EPSILON ? "text-stamp font-bold" : ""}` }, formatFraction(n.fraction)), /* @__PURE__ */ React.createElement("div", { className: `text-[10px] ${n.fraction < FRACTION_EPSILON ? "text-stamp font-bold" : "opacity-70"}` }, remainingFractionDisplay)))),
      isDeceased && n.obituary && /* @__PURE__ */ React.createElement("div", { className: "mt-3 pt-3 border-t border-sepia/20 text-left w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-1" }, "Death Notes"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-fountain whitespace-pre-wrap font-handwriting leading-relaxed" }, n.obituary)),
      relatedDocs.length > 0 && /* @__PURE__ */ React.createElement("div", { className: `mt-3 pt-3 border-t text-left w-full flex flex-col gap-1.5 ${isDeceased ? "border-sepia/20" : "border-ink/20"}` }, /* @__PURE__ */ React.createElement("div", { className: `text-[9px] uppercase tracking-widest mb-0.5 ${isDeceased ? "text-sepia/60" : "opacity-60"}` }, "Attached Records"), relatedDocs.map((doc) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: doc.id,
          onClick: (e) => {
            e.stopPropagation();
            openEdit(doc);
          },
          className: `flex items-center justify-between p-1.5 border transition-colors cursor-pointer ${isDeceased ? "border-sepia/40 bg-teastain hover:bg-sepia/10 text-sepia shadow-[2px_2px_0px_#704214]" : "border-ink bg-parchment hover:bg-teastain text-ink shadow-[2px_2px_0px_#1A1A1B]"}`,
          title: "Click to edit details"
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 overflow-hidden" }, /* @__PURE__ */ React.createElement(Icon, { name: "Paperclip", size: 10, className: "min-w-[10px] opacity-70" }), /* @__PURE__ */ React.createElement("span", { className: "font-serif font-bold text-[10px] uppercase tracking-wider truncate" }, doc.instrument)),
        doc.docData && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              setViewerData(doc.docData);
            },
            className: "p-1 hover:text-stamp transition-colors ml-2",
            title: "View Vault PDF"
          },
          /* @__PURE__ */ React.createElement(Icon, { name: "Eye", size: 12 })
        )
      ))),
      isCollapsed && hiddenDescendantCount > 0 && /* @__PURE__ */ React.createElement("div", { className: `mt-3 inline-flex items-center px-2 py-1 border rounded-sm text-[10px] font-mono uppercase tracking-wider ${isDeceased ? "border-sepia/40 bg-sepia/10 text-sepia" : "border-ink/40 bg-ink/5 text-ink/80"}` }, "+", hiddenDescendantCount, " descendants"),
      shouldSimplifyChildren && simplifiedHiddenCount > 0 && /* @__PURE__ */ React.createElement("div", { className: `mt-3 inline-flex items-center px-2 py-1 border rounded-sm text-[10px] font-mono uppercase tracking-wider ${isDeceased ? "border-sepia/40 bg-sepia/10 text-sepia" : "border-ink/40 bg-ink/5 text-ink/80"}` }, "Zoom Preview: +", simplifiedHiddenCount, " hidden descendants")
    ), /* @__PURE__ */ React.createElement("div", { className: "absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20" }, n.parentId === null && nodes.length > 1 && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      openAttach(n);
    }, className: "bg-sepia text-parchment border border-sepia rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-sepia/80 shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-all" }, /* @__PURE__ */ React.createElement(Icon, { name: "Link", size: 12 }), " ATTACH"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      openPrecede(n);
    }, className: "bg-ink text-parchment border border-parchment rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-ink/80 shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-transform" }, /* @__PURE__ */ React.createElement(Icon, { name: "ArrowUp", size: 12 }), " PRECEDE"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      openRebalance(n);
    }, className: "bg-fountain text-parchment border border-fountain rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-fountain/80 shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-transform" }, /* @__PURE__ */ React.createElement(Icon, { name: "Adjust", size: 12 }), " REBALANCE"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      openRelated(n);
    }, className: "bg-parchment text-ink border border-ink/40 rounded-sm px-3 py-1 text-[10px] font-bold hover:bg-teastain shadow-md flex items-center gap-1 hover:-translate-y-0.5 transition-transform" }, /* @__PURE__ */ React.createElement(Icon, { name: "Paperclip", size: 12 }), " + DOC"), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      openConvey(n);
    }, className: "bg-teastain text-sepia border border-sepia/60 rounded-sm px-4 py-1 text-[10px] font-bold hover:bg-parchment hover:border-sepia shadow-lg flex items-center gap-1 hover:-translate-y-0.5 transition-all" }, /* @__PURE__ */ React.createElement(Icon, { name: "Convey", size: 12 }), " CONVEY"), nodes.length > 1 && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
      e.stopPropagation();
      requestDeleteRecord(n);
    }, className: "bg-parchment text-stamp border border-stamp/60 rounded-sm p-1.5 text-[10px] font-bold hover:bg-teastain hover:border-stamp shadow-lg flex items-center justify-center hover:-translate-y-0.5 transition-all" }, /* @__PURE__ */ React.createElement(Icon, { name: "Trash", size: 14 })))), hasChildren && !isCollapsed && !shouldSimplifyChildren && /* @__PURE__ */ React.createElement("div", { className: "flex relative justify-center pt-8" }, n.children.map((c, i) => /* @__PURE__ */ React.createElement("div", { key: c.id, className: "relative flex flex-col items-center px-4" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-1/2 w-[1px] h-8 bg-ink -translate-x-1/2 -mt-8 z-0" }), n.children.length > 1 && /* @__PURE__ */ React.createElement("div", { className: `absolute -top-8 h-[1px] bg-ink z-0 ${i === 0 ? "left-1/2 right-0" : i === n.children.length - 1 ? "left-0 right-1/2" : "left-0 right-0"}` }), renderTreeNode(c, depth + 1)))));
  };
  const createTreeGroupId = () => `tg_${makeId()}`;
  const resolveTreeGroupId = (node) => node?.treeGroupId || (node?.id ? `tg_${node.id}` : createTreeGroupId());
  const normalizeFlowNodeGroups = (inputNodes = []) => inputNodes.map((node) => ({ ...node, treeGroupId: resolveTreeGroupId(node) }));
  const mergeFlowNodeGroups = (inputNodes, firstNodeId, secondNodeId) => {
    const firstNode = inputNodes.find((n) => n.id === firstNodeId);
    const secondNode = inputNodes.find((n) => n.id === secondNodeId);
    if (!firstNode || !secondNode) return inputNodes;
    const firstGroup = resolveTreeGroupId(firstNode);
    const secondGroup = resolveTreeGroupId(secondNode);
    if (firstGroup === secondGroup) return inputNodes;
    const unifiedGroup = [firstGroup, secondGroup].sort()[0];
    return inputNodes.map((node) => {
      const nodeGroup = resolveTreeGroupId(node);
      if (nodeGroup !== firstGroup && nodeGroup !== secondGroup) return { ...node, treeGroupId: nodeGroup };
      return { ...node, treeGroupId: unifiedGroup };
    });
  };
  const buildFlowLayoutFromNodes = (sourceNodes, idPrefix = "", xShift = 0, treeGroupId = "") => {
    const safePrefix = idPrefix ? `${idPrefix}-` : "";
    const normalNodes = sourceNodes.filter((n) => n.type !== "related");
    if (!normalNodes.length) return { nodes: [], edges: [], width: 0 };
    const newFlowNodes = [];
    const newFlowEdges = [];
    const nodePositions = {};
    let leafX = 0;
    const levelYSpacing = 280;
    const startY = 60;
    const childrenOf = (id) => normalNodes.filter((c) => c.parentId === id);
    const layoutNode = (nId, depth) => {
      const children = childrenOf(nId);
      if (children.length === 0) {
        nodePositions[nId] = { x: leafX, y: startY + depth * levelYSpacing };
        leafX += 340;
        return nodePositions[nId].x;
      }
      const childXs = children.map((c) => {
        newFlowEdges.push({ id: `e-${safePrefix}${nId}-${safePrefix}${c.id}`, source: `${safePrefix}${nId}`, target: `${safePrefix}${c.id}` });
        return layoutNode(c.id, depth + 1);
      });
      const myX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
      nodePositions[nId] = { x: myX, y: startY + depth * levelYSpacing };
      return myX;
    };
    const roots = normalNodes.filter((n) => n.parentId === null);
    roots.forEach((root2) => {
      layoutNode(root2.id, 0);
      leafX += 200;
    });
    const minX = Math.min(...Object.values(nodePositions).map((p) => p.x));
    const maxX = Math.max(...Object.values(nodePositions).map((p) => p.x + 280));
    const width = Math.max(280, maxX - minX);
    normalNodes.forEach((n) => {
      const pos = nodePositions[n.id] || { x: 0, y: 0 };
      newFlowNodes.push({
        id: `${safePrefix}${n.id}`,
        treeGroupId: treeGroupId || safePrefix || "default-tree",
        x: pos.x - minX + xShift,
        y: pos.y,
        type: "template",
        color: n.isDeceased ? "bg-teastain text-sepia border-sepia" : "bg-parchment text-ink border-ink",
        data: {
          title: n.instrument,
          grantee: n.grantee,
          grantor: n.grantor,
          fraction: formatFraction(n.fraction),
          fractionDisplay: n.fraction > FRACTION_EPSILON ? formatAsFraction(n.fraction) : null,
          details: `${n.date} ${n.vol && n.page ? `\u2022 Vol ${n.vol}/Pg ${n.page}` : ""}`
        }
      });
    });
    return { nodes: newFlowNodes, edges: newFlowEdges, width };
  };
  const getFlowSelectedDeskMaps = () => {
    if (flowDeskMapFilter === "all") return deskMaps;
    if (flowDeskMapFilter === "active") return deskMaps.filter((map) => map.id === activeDeskMapId);
    return deskMaps.filter((map) => map.id === flowDeskMapFilter);
  };
  const fitFlowToView = (targetNodes) => {
    const scopeNodes = targetNodes || flowNodes;
    if (!scopeNodes.length) return;
    const containerRect = flowCanvasRef.current?.getBoundingClientRect();
    const viewportW = Math.max(700, (containerRect?.width || window.innerWidth) - 80);
    const viewportH = Math.max(500, (containerRect?.height || window.innerHeight) - 110);
    const minX = Math.min(...scopeNodes.map((n) => n.x));
    const maxX = Math.max(...scopeNodes.map((n) => n.x + (n.type === "template" ? 280 : n.data.width || 280)));
    const minY = Math.min(...scopeNodes.map((n) => n.y));
    const maxY = Math.max(...scopeNodes.map((n) => n.y + (n.type === "template" ? 150 : 80)));
    const contentW = Math.max(300, maxX - minX);
    const contentH = Math.max(200, maxY - minY);
    const fitScale = Math.min(viewportW / contentW, viewportH / contentH, 1);
    setTreeScale(fitScale);
    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;
    const targetX = viewportW / 2 - centerX * fitScale;
    const targetY = viewportH / 2 - centerY * fitScale;
    setFlowPz({ x: Math.min(600, Math.max(-6e3, targetX)), y: Math.min(400, Math.max(-6e3, targetY)), scale: fitScale });
  };
  const importToFlowchart = (append = false) => {
    const selectedMaps = getFlowSelectedDeskMaps();
    if (!selectedMaps.length) {
      window.alert("No DeskMap selected for Flow Chart import.");
      return;
    }
    if (!append && flowNodes.length > 0 && !window.confirm("This will overwrite your current Flow Chart canvas. Proceed?")) return;
    let xCursor = append && flowNodes.length ? Math.max(...flowNodes.map((n) => n.x + 300)) + 200 : 0;
    const built = selectedMaps.map((map, i) => {
      const result = buildFlowLayoutFromNodes(map.nodes || [], `${map.id}-${i}-${makeId()}`, xCursor, map.id);
      xCursor += result.width + 220;
      return result;
    });
    const importedNodes = built.flatMap((b) => b.nodes);
    const importedEdges = built.flatMap((b) => b.edges);
    const nextNodes = append ? [...flowNodes, ...importedNodes] : importedNodes;
    const nextEdges = append ? [...flowEdges, ...importedEdges] : importedEdges;
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    recordAuditEvent("flowchart_imported", { append, deskMapCount: selectedMaps.length, nodeCount: nextNodes.length, edgeCount: nextEdges.length });
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
    if (!window.confirm("Delete this saved workspace permanently?")) return;
    const deletingActiveWorkspace = currentWorkspaceId === workspaceId;
    if (deletingActiveWorkspace) {
      setWorkspaceLoaded(false);
      setCurrentWorkspaceId(null);
      setShowHome(true);
    }
    await deleteWorkspace(workspaceId);
    const projects = await listWorkspaces();
    setSavedProjects(projects);
    if (deletingActiveWorkspace) {
      setProjectName("My Workspace");
      setShowCloudModal(false);
    }
  };
  const handleDeleteAllWorkspaces = async () => {
    if (!savedProjects.length) return;
    if (!window.confirm("Delete ALL saved workspaces? This cannot be undone.")) return;
    setWorkspaceLoaded(false);
    setCurrentWorkspaceId(null);
    setShowHome(true);
    await deleteAllWorkspaces();
    recordAuditEvent("workspace_deleted_all", { deletedCount: savedProjects.length });
    setSavedProjects([]);
    setProjectName("My Workspace");
    setShowCloudModal(false);
  };
  const handleReturnHome = async () => {
    try {
      await handleSaveWorkspace();
      const projects = await listWorkspaces();
      setSavedProjects(projects);
    } catch (e) {
      console.error(e);
    } finally {
      setView("chart");
      setWorkspaceLoaded(false);
      setActiveDeskMapId("");
      setDeskMaps([]);
      setNodes([{ ...defaultRoot }]);
      setPz({ ...defaultViewport });
      setShowHome(true);
    }
  };
  const addFlowNode = (type) => {
    const id = `fn_${makeId()}`;
    const scalerRect = document.getElementById("tree-scaler")?.getBoundingClientRect();
    const canvasRect = flowCanvasRef.current?.getBoundingClientRect();
    const anchorX = canvasRect ? canvasRect.left + canvasRect.width / 2 : window.innerWidth / 2;
    const anchorY = canvasRect ? canvasRect.top + canvasRect.height / 2 : window.innerHeight / 2;
    const newNode = {
      id,
      x: (anchorX - (scalerRect?.left || 0)) / (flowPz.scale * treeScale) - 140,
      y: (anchorY - (scalerRect?.top || 0)) / (flowPz.scale * treeScale) - 100,
      type,
      treeGroupId: selectedFlowNode ? resolveTreeGroupId(flowNodes.find((n) => n.id === selectedFlowNode)) : createTreeGroupId(),
      color: "bg-parchment text-ink border-ink",
      data: type === "template" ? {
        title: "Instrument",
        grantee: "Grantee Name",
        grantor: "Grantor Name",
        fraction: "1.00000000",
        details: "Date \u2022 Vol/Page"
      } : { text: "Double click to edit text...", width: 280 }
    };
    setFlowNodes([...flowNodes, newNode]);
    setSelectedFlowNode(id);
    setFlowForm(newNode.data);
    setFlowTool("select");
    setShowFlowEditModal(true);
  };
  const handleFlowPointerDown = (e) => {
    if (e.target.closest(".flow-node") || e.target.closest(".flow-ui")) return;
    if (flowTool === "pan") {
      isDragging.current = true;
      dragStart.current = { x: e.clientX - flowPz.x, y: e.clientY - flowPz.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedFlowNode(null);
    } else if (flowTool === "move-tree") {
      isDragging.current = true;
      moveTreeStartPos.current = { x: e.clientX, y: e.clientY };
      initialTreeNodes.current = flowNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));
      initialTreeNodeById.current = Object.fromEntries(initialTreeNodes.current.map((item) => [item.id, item]));
      moveTreeGroupId.current = null;
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedFlowNode(null);
    }
  };
  const handleFlowPointerMove = (e) => {
    if (flowTool === "connect" && connectingStart) {
      const rect = document.getElementById("tree-scaler").getBoundingClientRect();
      setMousePos({ x: (e.clientX - rect.left) / (flowPz.scale * treeScale), y: (e.clientY - rect.top) / (flowPz.scale * treeScale) });
    }
    if (!isDragging.current) return;
    if (flowTool === "pan") {
      flowPanPointRef.current = { x: e.clientX, y: e.clientY };
      if (flowPanFrameRef.current !== null) return;
      flowPanFrameRef.current = requestAnimationFrame(() => {
        flowPanFrameRef.current = null;
        const point = flowPanPointRef.current;
        if (!point) return;
        setFlowPz((prev) => ({ ...prev, x: point.x - dragStart.current.x, y: point.y - dragStart.current.y }));
      });
    } else if (flowTool === "move-tree" && moveTreeStartPos.current && initialTreeNodes.current) {
      const dx = (e.clientX - moveTreeStartPos.current.x) / (flowPz.scale * treeScale);
      const dy = (e.clientY - moveTreeStartPos.current.y) / (flowPz.scale * treeScale);
      const initialNodes = initialTreeNodes.current;
      const targetGroup = moveTreeGroupId.current;
      setFlowNodes((prev) => prev.map((n) => {
        if (targetGroup && resolveTreeGroupId(n) !== targetGroup) return n;
        const orig = initialTreeNodeById.current ? initialTreeNodeById.current[n.id] : initialNodes.find((o) => o.id === n.id);
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
    initialTreeNodeById.current = null;
    moveTreeGroupId.current = null;
    if (flowPanFrameRef.current !== null) {
      cancelAnimationFrame(flowPanFrameRef.current);
      flowPanFrameRef.current = null;
    }
    flowPanPointRef.current = null;
  };
  const handleFlowWheel = (e) => {
    if (e.ctrlKey || e.metaKey || flowTool === "pan") {
      e.preventDefault();
      const scaleAdjust = e.deltaY * -2e-3;
      const rect = e.currentTarget.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      setFlowPz((prev) => {
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
    if (flowTool === "connect") {
      setConnectingStart(node.id);
      const wOffset = node.type === "template" ? 140 : node.data.width ? node.data.width / 2 : 140;
      setMousePos({ x: node.x + wOffset, y: node.y + 100 });
    } else if (flowTool === "select") {
      setSelectedFlowNode(node.id);
      flowDraggingNode.current = { id: node.id, origX: node.x, origY: node.y };
      flowDragStart.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (flowTool === "move-tree") {
      isDragging.current = true;
      moveTreeStartPos.current = { x: e.clientX, y: e.clientY };
      initialTreeNodes.current = flowNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));
      initialTreeNodeById.current = Object.fromEntries(initialTreeNodes.current.map((item) => [item.id, item]));
      moveTreeGroupId.current = resolveTreeGroupId(node);
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedFlowNode(null);
    }
  };
  const handleNodePointerMove = (e) => {
    if (flowTool === "select" && flowDraggingNode.current) {
      e.stopPropagation();
      const dx = (e.clientX - flowDragStart.current.x) / (flowPz.scale * treeScale);
      const dy = (e.clientY - flowDragStart.current.y) / (flowPz.scale * treeScale);
      const draggedNode = flowDraggingNode.current;
      setFlowNodes((nodes2) => nodes2.map((n) => n.id === draggedNode.id ? { ...n, x: draggedNode.origX + dx, y: draggedNode.origY + dy } : n));
    } else if (flowTool === "move-tree" && isDragging.current && moveTreeStartPos.current && initialTreeNodes.current) {
      e.stopPropagation();
      const dx = (e.clientX - moveTreeStartPos.current.x) / (flowPz.scale * treeScale);
      const dy = (e.clientY - moveTreeStartPos.current.y) / (flowPz.scale * treeScale);
      const initialNodes = initialTreeNodes.current;
      const targetGroup = moveTreeGroupId.current;
      setFlowNodes((prev) => prev.map((n) => {
        if (targetGroup && resolveTreeGroupId(n) !== targetGroup) return n;
        const orig = initialTreeNodeById.current ? initialTreeNodeById.current[n.id] : initialNodes.find((o) => o.id === n.id);
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
    if (flowTool === "connect" && connectingStart && connectingStart !== targetNode.id) {
      const edgeExists = flowEdges.find((ed) => ed.source === connectingStart && ed.target === targetNode.id);
      if (!edgeExists) {
        setFlowEdges([...flowEdges, { id: `e-${connectingStart}-${targetNode.id}`, source: connectingStart, target: targetNode.id }]);
        setFlowNodes((prev) => mergeFlowNodeGroups(prev, connectingStart, targetNode.id));
      }
      setConnectingStart(null);
    }
    if (flowTool === "move-tree") {
      isDragging.current = false;
      moveTreeStartPos.current = null;
      initialTreeNodes.current = null;
      initialTreeNodeById.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const changeNodeColor = (colorClass) => {
    if (!selectedFlowNode) return;
    setFlowNodes((nodes2) => nodes2.map((n) => n.id === selectedFlowNode ? { ...n, color: colorClass } : n));
  };
  const deleteSelectedFlowElement = () => {
    if (!selectedFlowNode) return;
    setFlowNodes((nodes2) => nodes2.filter((n) => n.id !== selectedFlowNode));
    setFlowEdges((edges) => edges.filter((e) => e.source !== selectedFlowNode && e.target !== selectedFlowNode));
    setSelectedFlowNode(null);
  };
  const deleteFlowEdge = (edgeId) => {
    setFlowEdges((edges) => edges.filter((e) => e.id !== edgeId));
  };
  const commitFlowEdit = () => {
    setFlowNodes((nodes2) => nodes2.map((n) => n.id === selectedFlowNode ? { ...n, data: flowForm } : n));
    setShowFlowEditModal(false);
  };
  const drawEdge = (x1, y1, x2, y2) => {
    const yMid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`;
  };
  const flowNodeById = useMemo(() => Object.fromEntries(flowNodes.map((n) => [n.id, n])), [flowNodes]);
  const renderTree = (isInteractive) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("svg", { className: "absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-10" }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("marker", { id: "arrowhead-ink", markerWidth: "10", markerHeight: "7", refX: "9", refY: "3.5", orient: "auto" }, /* @__PURE__ */ React.createElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: "#1A1A1B" }))), flowEdges.map((edge) => {
    const source = flowNodeById[edge.source];
    const target = flowNodeById[edge.target];
    if (!source || !target) return null;
    const x1 = source.x + (source.type === "template" ? 140 : source.data.width ? source.data.width / 2 : 140);
    const y1 = source.y + (source.type === "template" ? 140 : 50);
    const x2 = target.x + (target.type === "template" ? 140 : target.data.width ? target.data.width / 2 : 140);
    const y2 = target.y;
    return /* @__PURE__ */ React.createElement("g", { key: edge.id, className: isInteractive ? "cursor-pointer pointer-events-auto" : "pointer-events-none", onClick: (e) => {
      if (isInteractive) {
        e.stopPropagation();
        if (flowTool === "select") deleteFlowEdge(edge.id);
      }
    } }, /* @__PURE__ */ React.createElement("path", { d: drawEdge(x1, y1, x2, y2), fill: "none", stroke: "#1A1A1B", strokeWidth: "2", markerEnd: "url(#arrowhead-ink)" }));
  }), isInteractive && flowTool === "connect" && connectingStart && flowNodeById[connectingStart] && /* @__PURE__ */ React.createElement(
    "path",
    {
      d: drawEdge(
        flowNodeById[connectingStart].x + (flowNodeById[connectingStart].type === "template" ? 140 : flowNodeById[connectingStart].data.width / 2 || 140),
        flowNodeById[connectingStart].y + 100,
        mousePos.x,
        mousePos.y
      ),
      fill: "none",
      stroke: "#1A1A1B",
      strokeWidth: "2",
      strokeDasharray: "5,5"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 w-full h-full z-20 pointer-events-none" }, flowNodes.map((n) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: n.id,
      id: isInteractive ? n.id : void 0,
      className: `flow-node absolute transition-shadow bg-parchment ${isInteractive ? "pointer-events-auto " + (flowTool === "select" ? "cursor-grab active:cursor-grabbing" : flowTool === "move-tree" ? "cursor-move" : flowTool === "connect" ? "cursor-crosshair" : "") : ""} ${isInteractive && selectedFlowNode === n.id ? "ring-4 ring-sepia/50 ring-offset-4 ring-offset-transparent" : ""}`,
      style: { transform: `translate(${n.x}px, ${n.y}px)` },
      onPointerDown: isInteractive ? (e) => handleNodePointerDown(e, n) : void 0,
      onPointerMove: isInteractive ? handleNodePointerMove : void 0,
      onPointerUp: isInteractive ? (e) => handleNodePointerUp(e, n) : void 0,
      onPointerCancel: isInteractive ? (e) => handleNodePointerUp(e, n) : void 0,
      onDoubleClick: isInteractive ? (e) => {
        e.stopPropagation();
        if (flowTool === "select") {
          setSelectedFlowNode(n.id);
          setFlowForm(n.data);
          setShowFlowEditModal(true);
        }
      } : void 0
    },
    n.type === "template" ? /* @__PURE__ */ React.createElement("div", { className: `w-[280px] p-4 border ${isInteractive ? "ink-shadow" : "border-ink"} ${n.color}` }, /* @__PURE__ */ React.createElement("div", { className: "border-b border-current/20 pb-2 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "font-serif text-xs font-bold uppercase tracking-widest text-sepia" }, n.data.title), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] opacity-60 mt-1" }, n.data.details)), /* @__PURE__ */ React.createElement("div", { className: "mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5" }, "Grantee / Assignee"), /* @__PURE__ */ React.createElement("div", { className: "font-display font-bold text-base leading-tight" }, n.data.grantee)), /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest text-sepia/60 font-mono mb-0.5" }, "Grantor / Assignor"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs truncate opacity-80" }, n.data.grantor)), /* @__PURE__ */ React.createElement("div", { className: "border-t border-current/20 pt-2 flex justify-between items-end" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] uppercase tracking-widest opacity-60 font-mono" }, "Interest"), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono font-bold text-sm" }, n.data.fraction), n.data.fractionDisplay && /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] opacity-60" }, n.data.fractionDisplay)))) : /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `p-5 border ${isInteractive ? "ink-shadow" : "border-ink"} ${n.color}`,
        style: { width: n.data.width || 280 }
      },
      /* @__PURE__ */ React.createElement("div", { className: "font-serif text-sm whitespace-pre-wrap break-words" }, n.data.text)
    )
  ))));
  const viewActions = {
    chart: [
      { key: "new-tree", label: "New Tree", icon: "Plus", onClick: openNewChain, title: "Start a completely separate independent lineage tree" },
      { key: "add-loose-record", label: "Add Loose Record", icon: "Plus", onClick: openAddUnlinked, title: "Add a document to the Parking Lot" },
      { key: "import-csv", label: "Import CSV", icon: "Upload", onClick: () => fileInput.current?.click(), title: "Upload Data" },
      { key: "save-data", label: "Save Data", icon: "Download", onClick: exportCSV, title: "Save Internal Data" }
    ],
    master: [
      { key: "export-runsheet", label: "Export Runsheet", icon: "FileText", onClick: exportToRunsheet, title: "Generate Chronological Runsheet" },
      { key: "toggle-conveyance-filter", label: showOnlyConveyances ? "Show All Records" : "Show Conveyances Only", icon: "List", onClick: () => setShowOnlyConveyances((prev) => !prev), title: "Toggle runsheet filter" },
      { key: "save-data", label: "Save Data", icon: "Download", onClick: exportCSV, title: "Save Internal Data" },
      { key: "import-csv", label: "Import CSV", icon: "Upload", onClick: () => fileInput.current?.click(), title: "Upload Data" }
    ],
    flowchart: [
      { key: "import-flowchart", label: "Import Tree \u2192 Flowchart", icon: "Upload", onClick: () => importToFlowchart(false), title: "Replace flowchart with transformed tree" },
      { key: "append-flowchart", label: "Append Tree \u2192 Flowchart", icon: "Plus", onClick: () => importToFlowchart(true), title: "Append transformed tree to flowchart" },
      { key: "print-flowchart", label: "Print Flowchart", icon: "Printer", onClick: handlePrintFlowchart, title: "Print flowchart layout" },
      { key: "clear-flowchart", label: "Clear Flowchart", icon: "Trash", onClick: handleClearFlowchart, title: "Remove all flowchart nodes/edges and reset layout defaults", destructive: true }
    ],
    research: [
      { key: "save-data", label: "Save Data", icon: "Download", onClick: exportCSV, title: "Save Internal Data" },
      { key: "import-csv", label: "Import CSV", icon: "Upload", onClick: () => fileInput.current?.click(), title: "Upload Data" }
    ]
  };
  const currentActions = viewActions[view] || [];
  const quickActions = [
    { key: "save-workspace", label: "Save", icon: "Download", onClick: handleSaveWorkspace, title: "Save workspace locally" },
    { key: "save-home", label: "Home", icon: "ArrowUp", onClick: handleReturnHome, title: "Save and return to startup page" }
  ];
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", { dangerouslySetInnerHTML: { __html: `@media print { @page { size: letter ${["landscape", "portrait"].includes(printOrientation) ? printOrientation : "portrait"}; margin: 0; } }` } }), showHome ? /* @__PURE__ */ React.createElement("div", { className: "h-screen w-screen p-4 sm:p-8 font-mono text-ink flex items-center justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-3xl bg-parchment/95 border border-ink/30 ink-shadow-lg rounded-2xl p-6 sm:p-8" }, /* @__PURE__ */ React.createElement("h1", { className: "font-serif text-3xl font-black tracking-tight" }, "LANDroid"), /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-sm text-ink/80" }, "Choose a saved workspace or start a new one."), /* @__PURE__ */ React.createElement("div", { className: "mt-5 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: handleEnterNewWorkspace, className: "px-4 py-2 text-xs font-bold rounded border border-ink bg-ink text-parchment" }, "Start New Workspace"), /* @__PURE__ */ React.createElement("button", { onClick: () => fileInput.current.click(), className: "px-4 py-2 text-xs font-bold rounded border border-ink/30 bg-teastain" }, "Import CSV")), /* @__PURE__ */ React.createElement("input", { type: "file", ref: fileInput, onChange: (e) => {
    importCSV(e);
    setWorkspaceLoaded(true);
    setShowHome(false);
  }, className: "hidden", accept: ".csv" }), /* @__PURE__ */ React.createElement("div", { className: "mt-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xs font-bold uppercase tracking-widest text-sepia" }, "Saved Workspaces"), /* @__PURE__ */ React.createElement("button", { "aria-label": "Delete All Workspaces", onClick: handleDeleteAllWorkspaces, className: "px-2 py-1 text-[10px] font-bold border border-stamp/60 text-stamp hover:bg-stamp hover:text-parchment rounded transition-colors" }, "Delete All")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 max-h-[45vh] overflow-auto border border-ink/20 rounded-lg bg-parchment" }, savedProjects.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "p-4 text-sm text-ink/60" }, "No saved workspaces yet.") : savedProjects.map((p) => /* @__PURE__ */ React.createElement("div", { key: p.id, className: "w-full border-b last:border-b-0 border-ink/10 flex items-center gap-2 p-2 hover:bg-teastain/40" }, /* @__PURE__ */ React.createElement("button", { onClick: () => handleLoadWorkspace(p, false), className: "flex-1 text-left p-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-sm" }, p.name || "Untitled Workspace"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-ink/60" }, "Updated ", new Date(p.updatedAt || Date.now()).toLocaleString())), /* @__PURE__ */ React.createElement("button", { "aria-label": `Delete Workspace ${p.name || p.id}`, onClick: () => handleDeleteWorkspace(p.id), className: "px-2 py-1 text-[10px] font-bold border border-stamp/60 text-stamp hover:bg-stamp hover:text-parchment transition-colors rounded", title: "Delete workspace" }, "Delete"))))))) : /* @__PURE__ */ React.createElement("div", { className: "h-screen w-screen overflow-hidden flex flex-col relative font-mono text-ink px-3 sm:px-5 py-3 sm:py-4 gap-3" }, /* @__PURE__ */ React.createElement("header", { className: "cyber-header-bg z-40 relative px-4 sm:px-6 py-4 flex justify-between items-start no-print rounded-2xl ink-shadow" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "font-serif text-2xl font-black tracking-tight flex items-baseline gap-2" }, "LANDroid", /* @__PURE__ */ React.createElement("span", { className: "text-sm font-normal text-sepia opacity-80 font-mono not-italic" }, "> by Abstract Mapping"))), /* @__PURE__ */ React.createElement("div", { className: "group flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: `rubber-stamp bg-parchment shadow-sm ${ownershipHealth.status === "over" ? "error animate-vibrate" : ""}` }, /* @__PURE__ */ React.createElement("span", { className: "opacity-80 text-xs mr-2" }, "Master Total:"), /* @__PURE__ */ React.createElement("span", { className: "text-lg" }, formatFraction(totalRootOwnership))), /* @__PURE__ */ React.createElement("span", { className: `px-2 py-1 text-[10px] border rounded font-bold uppercase tracking-widest ${ownershipHealth.status === "balanced" ? "border-green-700/40 text-green-800 bg-green-100/60" : ownershipHealth.status === "over" ? "border-stamp/60 text-stamp bg-stamp/10" : "border-amber-700/50 text-amber-900 bg-amber-100/70"}` }, ownershipHealth.label, " ", formatFraction(Math.abs(ownershipHealth.delta))))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-end gap-3 pt-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-end gap-1 text-[11px] font-bold" }, /* @__PURE__ */ React.createElement("span", { className: "px-2 py-1 rounded border border-ink/30 bg-teastain/60" }, "Offline mode active: ", bootChecks.offlineModeActive ? "Yes" : "No"), /* @__PURE__ */ React.createElement("span", { className: "px-2 py-1 rounded border border-ink/30 bg-teastain/60" }, "Cloud sync unavailable: ", !isOnline || bootChecks.cloudSyncUnavailable ? "Yes" : "No"), /* @__PURE__ */ React.createElement("span", { className: "px-2 py-1 rounded border border-ink/30 bg-teastain/60" }, "Sync status: ", syncSummary.status === "pending" ? `Pending (${syncSummary.pendingCount})` : "Synced")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-end gap-2 sm:gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex items-center bg-teastain/40 rounded-xl border border-ink/20 p-1.5 shadow-sm" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setView("chart"), className: `px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === "chart" ? "bg-ink text-parchment shadow-sm" : "text-ink/60 hover:text-ink hover:bg-parchment/50"}` }, /* @__PURE__ */ React.createElement(Icon, { name: "Chart", size: 14 }), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden md:inline" }, "Desk Map"), /* @__PURE__ */ React.createElement("span", { className: "md:hidden" }, "Map")), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("master"), className: `px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === "master" ? "bg-ink text-parchment shadow-sm" : "text-ink/60 hover:text-ink hover:bg-parchment/50"}` }, /* @__PURE__ */ React.createElement(Icon, { name: "Clock", size: 14 }), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden md:inline" }, "Runsheet"), /* @__PURE__ */ React.createElement("span", { className: "md:hidden" }, "Runsheet")), /* @__PURE__ */ React.createElement("div", { className: "hidden sm:block w-px h-5 bg-ink/20 mx-1" }), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("flowchart"), className: `px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === "flowchart" ? "bg-sepia text-parchment shadow-sm" : "text-sepia/80 hover:text-sepia hover:bg-parchment/50"}` }, /* @__PURE__ */ React.createElement(Icon, { name: "Flowchart", size: 14 }), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden md:inline" }, "Flow Chart"), /* @__PURE__ */ React.createElement("span", { className: "md:hidden" }, "Flow")), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("research"), className: `px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${view === "research" ? "bg-fountain text-parchment shadow-sm" : "text-fountain/80 hover:text-fountain hover:bg-parchment/50"}` }, /* @__PURE__ */ React.createElement(Icon, { name: "Users", size: 14 }), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden md:inline" }, "Research Hub"), /* @__PURE__ */ React.createElement("span", { className: "md:hidden" }, "Hub")))), /* @__PURE__ */ React.createElement("div", { className: "inline-flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 bg-parchment/70 rounded-xl border border-ink/20 p-1.5 shadow-sm" }, quickActions.map((action) => /* @__PURE__ */ React.createElement("button", { key: action.key, onClick: action.onClick, className: "px-3 py-1.5 text-xs font-bold text-ink/85 hover:text-ink hover:bg-parchment rounded transition-all flex items-center gap-2", title: action.title }, /* @__PURE__ */ React.createElement(Icon, { name: action.icon, size: 14 }), " ", /* @__PURE__ */ React.createElement("span", null, action.label))), /* @__PURE__ */ React.createElement("span", { className: "px-2 py-1 text-[10px] uppercase tracking-widest rounded border border-ink/20 bg-parchment/60 text-ink/60" }, isSaving ? "Saving\u2026" : "AutoSave On"), /* @__PURE__ */ React.createElement("div", { className: "relative", ref: actionsMenuRef }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setShowActionsMenu((prev) => !prev),
      className: "px-3 py-1.5 text-xs font-bold text-fountain/90 hover:text-fountain hover:bg-fountain/10 rounded transition-all flex items-center gap-2",
      "aria-haspopup": "menu",
      "aria-expanded": showActionsMenu,
      title: "Open view-specific actions"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "List", size: 14 }),
    " ",
    /* @__PURE__ */ React.createElement("span", null, "Actions \u25BE")
  ), showActionsMenu && /* @__PURE__ */ React.createElement("div", { className: "absolute right-0 mt-1 min-w-[220px] z-50 rounded-lg border border-ink/20 bg-parchment shadow-lg p-1" }, currentActions.length > 0 ? currentActions.map((action) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: action.key,
      onClick: () => {
        action.onClick();
        setShowActionsMenu(false);
      },
      className: `w-full px-3 py-2 text-left text-xs font-bold rounded transition-all flex items-center gap-2 ${action.destructive ? "text-stamp hover:text-stamp hover:bg-stamp/10" : "text-ink/80 hover:text-ink hover:bg-teastain/50"}`,
      title: action.title,
      role: "menuitem"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: action.icon, size: 13 }),
    /* @__PURE__ */ React.createElement("span", null, action.label)
  )) : /* @__PURE__ */ React.createElement("div", { className: "px-3 py-2 text-xs text-ink/60" }, "No actions available for this view."))), /* @__PURE__ */ React.createElement("input", { type: "file", ref: fileInput, onChange: importCSV, className: "hidden", accept: ".csv" })))), /* @__PURE__ */ React.createElement("main", { className: "flex-1 w-full flex flex-col relative overflow-hidden rounded-2xl border border-ink/20 bg-parchment/30 backdrop-blur-[1px]" }, view === "master" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-auto parchment-grid p-4 sm:p-6 animate-fade-in no-print rounded-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1800px] mx-auto bg-parchment/95 border border-ink/30 ink-shadow-lg overflow-hidden flex flex-col rounded-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 bg-gradient-to-r from-ink via-ink to-sepia text-parchment border-b border-ink/70 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "Clock", size: 16 }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold uppercase tracking-widest font-serif" }, "Master Runsheet Log")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[9px] uppercase tracking-widest text-parchment/80 font-bold" }, "DeskMap:"), /* @__PURE__ */ React.createElement("select", { value: runsheetDeskMapFilter, onChange: (e) => setRunsheetDeskMapFilter(e.target.value), className: "bg-parchment text-ink border border-parchment/30 text-[10px] px-2 py-1 rounded" }, /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active DeskMap"), /* @__PURE__ */ React.createElement("option", { value: "all" }, "All DeskMaps"), deskMaps.map((map) => /* @__PURE__ */ React.createElement("option", { key: `rs-${map.id}`, value: map.id }, map.code, " ", map.name ? `- ${map.name}` : "")))), /* @__PURE__ */ React.createElement("div", { className: "flex bg-ink border border-parchment/30 rounded-sm p-0.5" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowOnlyConveyances(false), className: `px-3 py-1 text-[9px] font-bold uppercase transition-all rounded-sm ${!showOnlyConveyances ? "bg-parchment text-ink shadow-sm" : "text-parchment/60 hover:text-parchment"}` }, "All Records"), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowOnlyConveyances(true), className: `px-3 py-1 text-[9px] font-bold uppercase transition-all rounded-sm ${showOnlyConveyances ? "bg-parchment text-ink shadow-sm" : "text-parchment/60 hover:text-parchment"}` }, "Conveyances Only")), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-mono opacity-60 hidden sm:flex items-center" }, looseRecordCount > 0 && !showOnlyConveyances && /* @__PURE__ */ React.createElement("span", { className: "text-parchment bg-stamp/80 px-2 py-0.5 rounded-sm mr-3 font-bold inline-flex items-center gap-1" }, looseRecordCount, " Loose Record(s) pending link"), "Sorted by Effective Date"))), recentMathAuditEvents.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border-b border-ink/20 bg-teastain/40" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest font-bold mb-2 text-sepia" }, "Recent Math Change Log"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-2 text-[11px]" }, recentMathAuditEvents.map((event) => /* @__PURE__ */ React.createElement("div", { key: event.id, className: "border border-ink/20 bg-parchment px-2 py-1.5 font-mono" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold uppercase text-[10px]" }, event.detail?.action || event.type), /* @__PURE__ */ React.createElement("span", { className: "opacity-70" }, " \xB7 node ", event.detail?.nodeId || "-"), /* @__PURE__ */ React.createElement("span", { className: "opacity-70" }, " \xB7 x", Number(event.detail?.scaleFactor || 0).toFixed(6)), /* @__PURE__ */ React.createElement("span", { className: "opacity-70" }, " \xB7 affected ", event.detail?.affectedCount || 0))))), /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-left text-sm whitespace-nowrap" }, /* @__PURE__ */ React.createElement("thead", { className: "bg-teastain/90 border-b border-ink/40 text-[9px] text-ink font-bold uppercase tracking-widest sticky top-0 z-10" }, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Instrument"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Inst Date"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "File Date"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Vol/Pg"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Grantor / Assignor"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Grantee / Subject"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Land Desc."), showOnlyConveyances && /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20 text-sepia" }, "Retained Share"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 border-r border-ink/20" }, "Remarks"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-2 text-right" }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-ink/20" }, filteredSortedNodes.map((n) => /* @__PURE__ */ React.createElement("tr", { key: n.id, className: `group cursor-pointer transition-colors ${n.parentId === "unlinked" ? "bg-[#E6DFCC]/50" : n.type === "related" ? "bg-teastain/80" : "bg-parchment hover:bg-teastain"}`, onClick: () => openEdit(n) }, /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 font-serif font-bold text-[11px] border-r border-ink/20" }, n.instrument, n.parentId === "unlinked" && /* @__PURE__ */ React.createElement("span", { className: "ml-2 px-1.5 py-0.5 bg-sepia/10 text-sepia text-[8px] uppercase tracking-wider rounded border border-sepia/30 font-mono inline-block" }, "Unlinked"), n.type === "related" && /* @__PURE__ */ React.createElement("span", { className: "ml-2 px-1.5 py-0.5 bg-ink/5 text-ink/60 text-[8px] uppercase tracking-wider rounded border border-ink/20 font-mono inline-block" }, "Related"), n.isDeceased && /* @__PURE__ */ React.createElement(Icon, { name: "Tombstone", size: 10, className: "inline ml-2 opacity-60 text-sepia" })), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 text-[11px] font-mono border-r border-ink/20" }, n.date), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 font-mono text-[11px] border-r border-ink/20" }, n.fileDate || "-"), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 font-mono text-[11px] border-r border-ink/20" }, n.vol && n.page ? `${n.vol}/${n.page}` : "-"), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 text-[11px] truncate max-w-[150px] border-r border-ink/20 opacity-80" }, n.grantor || "-"), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 font-serif font-bold text-[11px] truncate max-w-[200px] border-r border-ink/20" }, n.grantee), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 text-[11px] truncate max-w-[150px] border-r border-ink/20" }, n.landDesc || "-"), showOnlyConveyances && /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 font-bold font-mono text-[11px] border-r border-ink/20" }, formatFraction(n.fraction)), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 text-[10px] truncate max-w-[150px] italic border-r border-ink/20 opacity-60" }, n.remarks), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-1.5 text-right flex items-center justify-end gap-1" }, (n.parentId === "unlinked" || n.parentId === null) && nodes.length > 1 && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    openAttach(n);
  }, className: "px-2 py-1 bg-sepia text-parchment border border-sepia hover:bg-sepia/80 rounded-sm transition-colors text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ink-shadow" }, /* @__PURE__ */ React.createElement(Icon, { name: "Link", size: 10 }), " Attach"), n.docData && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    setViewerData(n.docData);
  }, className: "p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors text-stamp", title: "View PDF" }, /* @__PURE__ */ React.createElement(Icon, { name: "Eye", size: 14 })), n.parentId !== "unlinked" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    openPrecede(n);
  }, className: "p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors", title: "Insert Predecessor Record" }, /* @__PURE__ */ React.createElement(Icon, { name: "ArrowUp", size: 14 })), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    openRelated(n);
  }, className: "p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors", title: "Attach Related Doc" }, /* @__PURE__ */ React.createElement(Icon, { name: "Paperclip", size: 14 })), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    openRebalance(n);
  }, className: "p-1 border border-transparent hover:border-sepia/50 rounded-sm transition-colors", title: "Rebalance Branch Ownership" }, /* @__PURE__ */ React.createElement(Icon, { name: "Adjust", size: 14 })), /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    openConvey(n);
  }, className: "p-1 border border-transparent hover:border-sepia text-sepia rounded-sm transition-colors", title: "Convey from this row" }, /* @__PURE__ */ React.createElement(Icon, { name: "Convey", size: 14 }))), nodes.length > 1 && /* @__PURE__ */ React.createElement("button", { onClick: (e) => {
    e.stopPropagation();
    requestDeleteRecord(n);
  }, className: "p-1 border border-transparent hover:border-stamp/50 text-stamp rounded-sm transition-colors" }, /* @__PURE__ */ React.createElement(Icon, { name: "Trash", size: 14 })))))))))), view === "research" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-auto parchment-grid p-4 sm:p-6 animate-fade-in no-print rounded-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1800px] mx-auto bg-parchment/95 border border-ink/30 ink-shadow-lg overflow-hidden flex flex-col rounded-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 bg-gradient-to-r from-fountain via-ink to-sepia text-parchment border-b border-ink/70 flex items-center justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "Users", size: 16 }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold uppercase tracking-widest font-serif" }, "Research Hub")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-[10px] uppercase tracking-widest" }, /* @__PURE__ */ React.createElement("span", null, contacts.length, " Contacts"), /* @__PURE__ */ React.createElement("span", null, "\u2022"), /* @__PURE__ */ React.createElement("span", null, contactLogs.length, " Log Entries"))), /* @__PURE__ */ React.createElement("div", { className: "p-3 border-b border-ink/20 bg-teastain/60 flex gap-2 flex-wrap" }, [
    { key: "contacts", label: "Contacts (Placeholder)", icon: "Users" }
  ].map((tab) => /* @__PURE__ */ React.createElement("button", { key: tab.key, onClick: () => setResearchTab(tab.key), className: `px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${researchTab === tab.key ? "bg-ink text-parchment shadow-sm" : "text-ink/70 hover:text-ink hover:bg-parchment/50"}` }, /* @__PURE__ */ React.createElement(Icon, { name: tab.icon, size: 13 }), " ", tab.label))), false, researchTab === "contacts" && /* @__PURE__ */ React.createElement("div", { className: "p-6" }, /* @__PURE__ */ React.createElement("div", { className: "border border-dashed border-ink/40 rounded-xl p-6 bg-parchment text-center" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-bold uppercase tracking-widest mb-2" }, "Contacts Placeholder"), /* @__PURE__ */ React.createElement("p", { className: "text-xs opacity-70" }, "Contact workflows are temporarily hidden while we redesign this area."))), false)), view === "chart" && /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `flex-1 overflow-hidden relative parchment-grid ${isDragging.current ? "cursor-grabbing select-none" : "cursor-grab"} animate-fade-in no-print rounded-2xl`,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onWheel: handleWheel
    },
    /* @__PURE__ */ React.createElement("div", { className: "absolute top-3 left-3 z-30 flex items-center gap-2 bg-parchment/95 border border-ink/30 rounded-lg px-2 py-2 ink-shadow" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] uppercase tracking-widest font-bold text-sepia" }, "DeskMap"), /* @__PURE__ */ React.createElement("select", { className: "border border-ink p-1 text-xs min-w-[180px]", value: activeDeskMapId, onChange: (e) => setActiveDeskMapId(e.target.value) }, deskMaps.map((map) => /* @__PURE__ */ React.createElement("option", { key: map.id, value: map.id }, formatDeskMapLabel(map)))), /* @__PURE__ */ React.createElement("button", { onClick: addDeskMap, className: "px-2 py-1 text-[10px] font-bold border border-ink hover:bg-ink hover:text-parchment transition-colors" }, "+ DeskMap"), /* @__PURE__ */ React.createElement("input", { value: deskMapCodeDraft, onChange: (e) => {
      setIsEditingDeskMapName(true);
      setDeskMapCodeDraft(e.target.value);
    }, onBlur: () => renameActiveDeskMap(), onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renameActiveDeskMap(deskMapNameDraft, e.currentTarget.value);
      }
    }, className: "border border-ink/40 p-1 text-xs w-[110px] bg-parchment", placeholder: "Tract code" }), /* @__PURE__ */ React.createElement("input", { value: deskMapNameDraft, onChange: (e) => {
      setIsEditingDeskMapName(true);
      setDeskMapNameDraft(e.target.value);
    }, onBlur: () => renameActiveDeskMap(), onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renameActiveDeskMap(e.currentTarget.value, deskMapCodeDraft);
      }
    }, className: "border border-ink/40 p-1 text-xs min-w-[140px] bg-parchment", placeholder: "DeskMap name" }), /* @__PURE__ */ React.createElement("button", { onClick: () => renameActiveDeskMap(), className: "px-2 py-1 text-[10px] font-bold border border-ink/40 hover:bg-teastain transition-colors" }, "Save Name")),
    /* @__PURE__ */ React.createElement("div", { ref: chartViewportRef, style: { transform: `translate3d(${pz.x}px, ${pz.y}px, 0) scale(${pz.scale})`, transformOrigin: "0 0", willChange: "transform", contain: "layout paint style" }, className: "w-max h-max min-w-full min-h-full flex justify-start pt-24 pb-48 gap-24" }, tree.map((n) => renderTreeNode(n)))
  ), view === "flowchart" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-hidden relative parchment-grid animate-fade-in flex flex-col print-canvas-container rounded-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-4 left-1/2 -translate-x-1/2 bg-parchment/95 border border-ink/30 ink-shadow-lg z-50 flex items-center p-2 gap-2 no-print rounded-2xl max-w-[94vw]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 bg-teastain border border-ink px-2 py-1 rounded-md" }, /* @__PURE__ */ React.createElement("label", { className: "text-[9px] font-bold uppercase tracking-widest text-ink", htmlFor: "flow-tool-select" }, "Tool"), /* @__PURE__ */ React.createElement(
    "select",
    {
      id: "flow-tool-select",
      value: flowTool,
      onChange: (e) => setFlowTool(e.target.value),
      "aria-label": "Flowchart active tool",
      className: "px-2 py-1 text-[10px] font-bold uppercase border border-ink/30 bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
    },
    /* @__PURE__ */ React.createElement("option", { value: "select" }, "Move Box"),
    /* @__PURE__ */ React.createElement("option", { value: "move-tree" }, "Move Tree"),
    /* @__PURE__ */ React.createElement("option", { value: "pan" }, "Pan Canvas"),
    /* @__PURE__ */ React.createElement("option", { value: "connect" }, "Link Boxes")
  )), /* @__PURE__ */ React.createElement("button", { onClick: () => addFlowNode("template"), "aria-label": "Add templated flowchart box", className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, /* @__PURE__ */ React.createElement(Icon, { name: "Plus", size: 12 }), " Box"), /* @__PURE__ */ React.createElement("button", { onClick: () => addFlowNode("blank"), "aria-label": "Add blank note box", className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, /* @__PURE__ */ React.createElement(Icon, { name: "Plus", size: 12 }), " Note"), /* @__PURE__ */ React.createElement("button", { onClick: () => fitFlowToView(), "aria-label": "Fit all flow nodes to view", className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink/40 text-ink hover:bg-ink hover:text-parchment flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia", title: "Recenter and fit all flow nodes to the current canvas" }, /* @__PURE__ */ React.createElement(Icon, { name: "Move", size: 12 }), " Fit View"), /* @__PURE__ */ React.createElement("button", { onClick: handlePrintFlowchart, "aria-label": "Print flowchart", className: "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-ink bg-ink text-parchment hover:bg-ink/80 flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, /* @__PURE__ */ React.createElement(Icon, { name: "Printer", size: 12 }), " Print"), /* @__PURE__ */ React.createElement("div", { className: "relative", ref: flowLayoutMenuRef }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setShowFlowLayoutMenu((v) => !v),
      "aria-label": "Toggle layout and import controls",
      "aria-haspopup": "menu",
      "aria-expanded": showFlowLayoutMenu,
      className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia text-sepia hover:bg-sepia hover:text-parchment flex items-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "List", size: 12 }),
    " Layout & Import"
  ), showFlowLayoutMenu && /* @__PURE__ */ React.createElement("div", { className: "absolute right-0 mt-2 w-[320px] bg-parchment border border-ink/40 ink-shadow-lg rounded-lg p-3 space-y-3", role: "menu", "aria-label": "Layout and import controls" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-bold uppercase tracking-widest text-ink/60 mb-1 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "Chart", size: 11 }), " Paper Boundaries"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold uppercase text-ink" }, "Grid"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setGridCols((c) => Math.max(1, c - 1)), "aria-label": "Decrease grid columns", className: "w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, "-"), /* @__PURE__ */ React.createElement("span", { className: "w-5 text-center text-[10px] font-mono font-bold", "aria-label": `Grid columns ${gridCols}` }, gridCols), /* @__PURE__ */ React.createElement("button", { onClick: () => setGridCols((c) => c + 1), "aria-label": "Increase grid columns", className: "w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, "+")), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-ink/50" }, "x"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setGridRows((r) => Math.max(1, r - 1)), "aria-label": "Decrease grid rows", className: "w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, "-"), /* @__PURE__ */ React.createElement("span", { className: "w-5 text-center text-[10px] font-mono font-bold", "aria-label": `Grid rows ${gridRows}` }, gridRows), /* @__PURE__ */ React.createElement("button", { onClick: () => setGridRows((r) => r + 1), "aria-label": "Increase grid rows", className: "w-5 h-5 flex items-center justify-center bg-teastain hover:bg-ink hover:text-parchment border border-ink text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, "+"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold uppercase tracking-widest text-ink" }, "Scale"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min: "0.2",
      max: "1.5",
      step: "0.05",
      value: treeScale,
      onChange: (e) => setTreeScale(Number(e.target.value)),
      "aria-label": "Adjust tree scale",
      className: "w-full accent-sepia cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia",
      title: "Scale the tree to fit inside the paper bounds"
    }
  )), /* @__PURE__ */ React.createElement("button", { onClick: () => setPrintOrientation((prev) => prev === "portrait" ? "landscape" : "portrait"), "aria-label": "Toggle print orientation", className: "mt-2 px-2 py-1.5 w-full text-[10px] font-bold uppercase tracking-widest border border-ink bg-parchment hover:bg-teastain flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, /* @__PURE__ */ React.createElement(Icon, { name: "FileText", size: 12 }), " ", printOrientation === "portrait" ? "Portrait" : "Landscape")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-bold uppercase tracking-widest text-ink/60 mb-1 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "Download", size: 11 }), " Import Source"), /* @__PURE__ */ React.createElement("select", { value: flowDeskMapFilter, onChange: (e) => setFlowDeskMapFilter(e.target.value), "aria-label": "Flow source selector", className: "w-full px-2 py-1.5 text-[10px] font-bold border border-ink/30 bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia" }, /* @__PURE__ */ React.createElement("option", { value: "active" }, "Flow Source: Active DeskMap"), /* @__PURE__ */ React.createElement("option", { value: "all" }, "Flow Source: All DeskMaps"), deskMaps.map((map) => /* @__PURE__ */ React.createElement("option", { key: `flow-${map.id}`, value: map.id }, "Flow Source: ", map.code, " ", map.name ? `- ${map.name}` : ""))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mt-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => importToFlowchart(false), "aria-label": "Import selected deskmaps into flowchart", className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia text-sepia hover:bg-sepia hover:text-parchment flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia", title: "Load selected DeskMap(s) into Flow Chart" }, /* @__PURE__ */ React.createElement(Icon, { name: "Download", size: 12 }), " Import"), /* @__PURE__ */ React.createElement("button", { onClick: () => importToFlowchart(true), "aria-label": "Import and append selected deskmaps into flowchart", className: "px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-sepia/50 text-sepia hover:bg-sepia/10 flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia", title: "Append selected DeskMap(s) to existing Flow Chart" }, /* @__PURE__ */ React.createElement(Icon, { name: "Plus", size: 12 }), " Append")))))), selectedFlowNode && flowTool === "select" && /* @__PURE__ */ React.createElement("div", { className: "absolute top-20 right-4 bg-parchment border border-ink ink-shadow-lg z-50 p-4 w-64 no-print animate-fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-ink/20 pb-2 flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", null, "Box Properties"), /* @__PURE__ */ React.createElement("button", { onClick: () => setSelectedFlowNode(null) }, /* @__PURE__ */ React.createElement(Icon, { name: "Close", size: 12 }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-4 justify-between" }, /* @__PURE__ */ React.createElement("button", { onClick: () => changeNodeColor("bg-parchment text-ink border-ink"), className: "w-8 h-8 rounded-sm border border-ink bg-parchment", title: "Parchment" }), /* @__PURE__ */ React.createElement("button", { onClick: () => changeNodeColor("bg-teastain text-sepia border-sepia"), className: "w-8 h-8 rounded-sm border border-sepia bg-teastain", title: "Tea-Stain" }), /* @__PURE__ */ React.createElement("button", { onClick: () => changeNodeColor("bg-sepia text-parchment border-sepia"), className: "w-8 h-8 rounded-sm border border-sepia bg-sepia", title: "Sepia" }), /* @__PURE__ */ React.createElement("button", { onClick: () => changeNodeColor("bg-ink text-parchment border-ink"), className: "w-8 h-8 rounded-sm border border-ink bg-ink", title: "Ink" })), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const node = flowNodes.find((n) => n.id === selectedFlowNode);
    setFlowForm(node.data);
    setShowFlowEditModal(true);
  }, className: "w-full py-2 border border-ink mb-2 text-xs font-bold uppercase hover:bg-ink hover:text-parchment transition-colors" }, "Edit Content"), /* @__PURE__ */ React.createElement("div", { className: "mb-2 border border-ink/20 bg-teastain/20 px-2 py-1.5 text-[10px]" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold uppercase tracking-widest text-ink/70 mb-1" }, "Tree Group"), /* @__PURE__ */ React.createElement("label", { className: "flex items-center justify-between gap-2 text-[10px] text-ink" }, /* @__PURE__ */ React.createElement("span", null, "Move as tree group"), /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: true, readOnly: true, "aria-label": "Move as tree group" })), /* @__PURE__ */ React.createElement("div", { className: "mt-1 font-mono text-[9px] break-all text-ink/70" }, resolveTreeGroupId(flowNodes.find((n) => n.id === selectedFlowNode)))), /* @__PURE__ */ React.createElement("button", { onClick: deleteSelectedFlowElement, className: "w-full py-2 border border-transparent text-stamp hover:border-stamp/50 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "Trash", size: 14 }), " Delete Node")), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: flowCanvasRef,
      className: `flex-1 relative overflow-hidden no-print ${flowTool === "pan" ? "cursor-grab active:cursor-grabbing" : flowTool === "move-tree" ? "cursor-move" : flowTool === "connect" ? "cursor-crosshair" : "cursor-default"}`,
      onPointerDown: (e) => {
        if (flowTool === "pan" || flowTool === "move-tree") handleFlowPointerDown(e);
      },
      onPointerMove: handleFlowPointerMove,
      onPointerUp: handleFlowPointerUp,
      onPointerCancel: handleFlowPointerUp,
      onWheel: handleFlowWheel,
      onClick: () => flowTool === "select" && setSelectedFlowNode(null)
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "absolute top-0 left-0 pan-zoom-layer",
        style: { transform: `translate(${flowPz.x}px, ${flowPz.y}px) scale(${flowPz.scale})`, transformOrigin: "0 0" }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "paper-visual bg-parchment shadow-[12px_12px_0px_rgba(26,26,27,0.2)] relative border border-ink",
          style: {
            width: pw * gridCols,
            height: ph * gridRows
          }
        },
        /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none z-30 overflow-hidden" }, Array.from({ length: gridCols - 1 }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: `v-${i}`, className: "absolute top-0 bottom-0 border-l-[2px] border-dashed border-stamp/40", style: { left: (i + 1) * pw } })), Array.from({ length: gridRows - 1 }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: `h-${i}`, className: "absolute left-0 right-0 border-t-[2px] border-dashed border-stamp/40", style: { top: (i + 1) * ph } })), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 border border-dashed border-ink/30 m-8 flex items-end justify-end p-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-ink/50 font-bold text-[10px] uppercase tracking-widest text-right bg-parchment px-2" }, "Print Boundary (", gridCols, "x", gridRows, " ", printOrientation, ")"))),
        /* @__PURE__ */ React.createElement(
          "div",
          {
            id: "tree-scaler",
            className: "absolute top-0 left-0 w-full h-full",
            style: { transform: `scale(${treeScale})`, transformOrigin: "0 0" }
          },
          renderTree(true)
        )
      )
    )
  ), isPrinting && /* @__PURE__ */ React.createElement("div", { className: "print-only w-full" }, Array.from({ length: gridRows }).map(
    (_, r) => Array.from({ length: gridCols }).map((_2, c) => /* @__PURE__ */ React.createElement("div", { key: `print-page-${r}-${c}`, className: "print-page-break bg-white", style: { width: pw + "px", height: ph + "px" } }, /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { top: -(r * ph) + "px", left: -(c * pw) + "px", width: pw * gridCols + "px", height: ph * gridRows + "px" } }, /* @__PURE__ */ React.createElement("div", { style: { transform: `scale(${treeScale})`, transformOrigin: "0 0", width: "100%", height: "100%" } }, renderTree(false)))))
  )), showFlowEditModal && flowForm && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-ink/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in no-print pointer-events-auto" }, /* @__PURE__ */ React.createElement("div", { className: "bg-parchment border border-ink p-6 w-full max-w-md ink-shadow-lg flex flex-col gap-4 animate-slide-up" }, /* @__PURE__ */ React.createElement("h3", { className: "font-serif font-black text-xl border-b-[2px] border-ink pb-2" }, "Edit Canvas Element"), flowNodes.find((n) => n.id === selectedFlowNode)?.type === "template" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Instrument Title"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink p-2 bg-teastain", value: flowForm.title, onChange: (e) => setFlowForm({ ...flowForm, title: e.target.value }) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Grantee"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink p-2 bg-teastain font-serif font-bold", value: flowForm.grantee, onChange: (e) => setFlowForm({ ...flowForm, grantee: e.target.value }) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Grantor"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink p-2 bg-teastain", value: flowForm.grantor, onChange: (e) => setFlowForm({ ...flowForm, grantor: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Date / Vol / Page"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink p-2 bg-teastain", value: flowForm.details, onChange: (e) => setFlowForm({ ...flowForm, details: e.target.value }) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Fraction"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink p-2 bg-teastain font-mono", value: flowForm.fraction, onChange: (e) => setFlowForm({ ...flowForm, fraction: e.target.value }) })))) : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mb-1" }, "Text Content"), /* @__PURE__ */ React.createElement("textarea", { className: "w-full border border-ink p-2 bg-teastain h-32 font-serif resize-y", value: flowForm.text, onChange: (e) => setFlowForm({ ...flowForm, text: e.target.value }) }), /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase tracking-widest block mt-4 mb-1" }, "Box Width: ", flowForm.width || 280, "px"), /* @__PURE__ */ React.createElement("input", { type: "range", min: "150", max: "800", value: flowForm.width || 280, onChange: (e) => setFlowForm({ ...flowForm, width: parseInt(e.target.value) }), className: "w-full accent-sepia cursor-pointer" })), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end gap-2 mt-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowFlowEditModal(false), className: "px-4 py-2 border border-ink/30 text-xs font-bold uppercase tracking-widest hover:border-stamp/50 hover:text-stamp transition-colors" }, "Cancel"), /* @__PURE__ */ React.createElement("button", { onClick: commitFlowEdit, className: "px-6 py-2 bg-sepia/10 text-sepia border border-sepia/40 text-xs font-bold uppercase tracking-widest hover:-translate-y-0.5 transition-all" }, "Save")))))), showModal && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-ink/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in font-mono text-ink" }, /* @__PURE__ */ React.createElement("div", { ref: modalRef, tabIndex: -1, onKeyDown: handleModalKeyDown, className: "bg-parchment border border-ink ink-shadow-lg w-full max-w-5xl overflow-hidden flex flex-col max-h-full animate-slide-up outline-none" }, /* @__PURE__ */ React.createElement("div", { className: `px-8 py-6 flex justify-between items-center border-b-[2px] border-ink ${modalMode === "convey" ? "bg-sepia text-parchment" : modalMode === "add_related" ? "bg-fountain text-parchment" : modalMode === "attach" ? "bg-fountain text-parchment" : modalMode === "precede" ? "bg-ink text-parchment" : modalMode === "rebalance" ? "bg-fountain text-parchment" : modalMode === "add_unlinked" ? "bg-fountain text-parchment" : modalMode === "add_chain" ? "bg-fountain text-parchment" : "bg-ink text-parchment"}` }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-serif font-black tracking-tight text-parchment" }, modalMode === "edit" ? "Update Record" : modalMode === "add_related" ? "Attach Related Document" : modalMode === "attach" ? "Link Imported Document to Lineage" : modalMode === "precede" ? "Insert Preceding Record" : modalMode === "rebalance" ? "Rebalance Branch Ownership" : modalMode === "add_unlinked" ? "Add Loose Document" : modalMode === "add_chain" ? "Start New Title Chain" : "Convey Title Link"), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] opacity-80 uppercase font-bold tracking-widest mt-1" }, modalMode === "add_related" ? "Non-Conveying Title Work (e.g., Probates, Affidavits)" : modalMode === "add_unlinked" ? "Parking lot record to be attached to the main lineage later" : modalMode === "add_chain" ? "Independent starting point for a separate lineage map" : "Protocol Lineage Analysis & Net-interest Database")), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowModal(false), className: "border border-transparent hover:border-current p-2 rounded-sm transition-all" }, /* @__PURE__ */ React.createElement(Icon, { name: "Close", size: 20 }))), /* @__PURE__ */ React.createElement("div", { className: "p-8 overflow-y-auto custom-scrollbar flex-1 bg-parchment" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-6 gap-6" }, modalMode === "attach" && /* @__PURE__ */ React.createElement("div", { className: "col-span-6 bg-teastain border border-ink p-5 mb-2 shadow-inner" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-widest" }, "Select Parent Title Link"), /* @__PURE__ */ React.createElement("select", { className: "w-full border border-ink rounded-sm p-3 bg-teastain outline-none font-bold", value: attachParentId, onChange: (e) => setAttachParentId(e.target.value) }, nodes.filter((n) => n.parentId !== "unlinked" && n.id !== activeNode?.id).map((n) => /* @__PURE__ */ React.createElement("option", { key: n.id, value: n.id }, n.instrument, " - ", n.grantee, " (", n.date, ")")))), /* @__PURE__ */ React.createElement("div", { className: "w-full sm:w-1/3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-widest" }, "Attachment Type"), /* @__PURE__ */ React.createElement("select", { className: "w-full border border-ink rounded-sm p-3 bg-teastain outline-none font-bold", value: attachType, onChange: (e) => setAttachType(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "conveyance" }, "Conveyance (Math Engine)"), /* @__PURE__ */ React.createElement("option", { value: "related" }, "Related Branch Doc")))), attachType === "conveyance" && /* @__PURE__ */ React.createElement("div", { className: `mt-4 border p-3 text-xs ${attachImpact?.valid ? "border-ink/40 bg-parchment/80" : "border-stamp/40 bg-stamp/10 text-stamp"}` }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase tracking-widest font-bold mb-2" }, "Attach Impact Preview"), attachImpact?.valid ? /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "opacity-60" }, "Destination:"), " ", attachImpact.destinationName), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "opacity-60" }, "Destination Balance:"), " ", formatFraction(attachImpact.destinationBefore), " \u2192 ", formatFraction(attachImpact.destinationAfter)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "opacity-60" }, "Attached Root:"), " ", formatFraction(attachImpact.rootBefore), " \u2192 ", formatFraction(attachImpact.rootAfter)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "opacity-60" }, "Scale Factor:"), " ", attachImpact.scaleFactor.toFixed(6), "x"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "opacity-60" }, "Descendants Updated:"), " ", attachImpact.descendantCount)) : /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, attachImpact?.reason || "Select a valid destination to preview impact."))), /* @__PURE__ */ React.createElement("div", { className: "col-span-6 sm:col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Instrument (B)"), isAddingInst ? /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("input", { type: "text", className: "flex-1 border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none font-bold", value: newInst, onChange: (e) => setNewInst(e.target.value), placeholder: "New Instrument Type...", autoFocus: true }), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    if (newInst.trim() && !instrumentList.includes(newInst.trim())) {
      setInstrumentList([...instrumentList, newInst.trim()]);
      setForm({ ...form, instrument: newInst.trim() });
    } else if (instrumentList.includes(newInst.trim())) {
      setForm({ ...form, instrument: newInst.trim() });
    }
    setIsAddingInst(false);
    setNewInst("");
  }, className: "px-4 bg-sepia/10 text-sepia border border-sepia/40 font-bold hover:bg-sepia/20 transition-colors" }, "Add"), /* @__PURE__ */ React.createElement("button", { onClick: () => setIsAddingInst(false), className: "px-3 bg-teastain border border-ink hover:border-sepia hover:text-sepia transition-colors" }, /* @__PURE__ */ React.createElement(Icon, { name: "Close", size: 16 }))) : /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("select", { className: "flex-1 border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none font-bold cursor-pointer", value: form.instrument, onChange: (e) => setForm({ ...form, instrument: e.target.value }) }, instrumentList.map((inst) => /* @__PURE__ */ React.createElement("option", { key: inst, value: inst }, inst))), /* @__PURE__ */ React.createElement("button", { onClick: () => setIsAddingInst(true), className: "px-3 bg-teastain border border-ink hover:border-sepia hover:text-sepia transition-colors", title: "Add New Instrument Type" }, /* @__PURE__ */ React.createElement(Icon, { name: "Plus", size: 16 })), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    if (instrumentList.length > 1) {
      const newList = instrumentList.filter((i) => i !== form.instrument);
      setInstrumentList(newList);
      setForm({ ...form, instrument: newList[0] });
    }
  }, className: "px-3 bg-teastain border border-ink hover:text-stamp hover:border-stamp/50 transition-colors", title: "Delete Selected Instrument Type" }, /* @__PURE__ */ React.createElement(Icon, { name: "Trash", size: 16 })))), /* @__PURE__ */ React.createElement("div", { className: "col-span-3 sm:col-span-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Vol (E)"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none", value: form.vol, onChange: (e) => setForm({ ...form, vol: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-3 sm:col-span-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Page (F)"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink rounded-sm p-3 bg-teastain focus:ring-2 focus:ring-sepia outline-none", value: form.page, onChange: (e) => setForm({ ...form, page: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-6 sm:col-span-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Inst No. (G)"), /* @__PURE__ */ React.createElement("input", { type: "text", className: "w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none font-bold ", value: form.docNo, onChange: (e) => setForm({ ...form, docNo: e.target.value }), placeholder: "Auto" })), (modalMode !== "add_related" || form.type !== "related") && /* @__PURE__ */ React.createElement("div", { className: "col-span-6 sm:col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-widest text-sepia/80" }, "Grantor / Assignor (J)"), /* @__PURE__ */ React.createElement("input", { type: "text", className: `w-full border border-ink rounded-sm p-3 ${modalMode === "convey" ? "bg-teastain opacity-80" : "bg-parchment"} outline-none `, value: form.grantor, onChange: (e) => setForm({ ...form, grantor: e.target.value }), readOnly: modalMode === "convey" })), /* @__PURE__ */ React.createElement("div", { className: `col-span-6 ${modalMode === "add_related" || form.type === "related" ? "sm:col-span-6" : "sm:col-span-3"} relative` }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-end mb-1.5" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase block tracking-widest text-sepia/80" }, modalMode === "add_related" || form.type === "related" ? "Subject / Associated Party" : "Grantee / Assignee (K)"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setShowGranteeList(!showGranteeList),
      className: "text-[9px] font-bold uppercase tracking-widest text-sepia/50 hover:text-sepia border-b border-transparent hover:border-sepia/50 transition-colors flex items-center gap-1"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "List", size: 10 }),
    " Existing Parties"
  )), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 items-stretch" }, /* @__PURE__ */ React.createElement("input", { type: "text", className: "flex-1 w-full border border-sepia rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none font-serif font-black shadow-[2px_2px_0px_#704214]", value: form.grantee, onChange: (e) => setForm({ ...form, grantee: e.target.value }) }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setForm({ ...form, isDeceased: !form.isDeceased }),
      className: `px-4 border border-sepia rounded-sm transition-all flex items-center justify-center shadow-[2px_2px_0px_#704214] ${form.isDeceased ? "bg-teastain text-sepia" : "bg-parchment text-sepia/30 hover:text-sepia hover:bg-teastain"}`,
      title: form.isDeceased ? "Remove Graveyard Protocol" : "Mark as Deceased"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "Tombstone", size: 20 })
  )), showGranteeList && /* @__PURE__ */ React.createElement("div", { className: "absolute top-full left-0 mt-1 w-full bg-teastain border border-ink ink-shadow max-h-48 overflow-y-auto custom-scrollbar z-50" }, uniqueGrantees.length > 0 ? uniqueGrantees.map((g) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: g,
      className: "p-3 border-b border-ink/10 hover:bg-parchment cursor-pointer font-serif font-bold text-sm text-ink truncate transition-colors",
      onClick: () => {
        setForm({ ...form, grantee: g });
        setShowGranteeList(false);
      }
    },
    g
  )) : /* @__PURE__ */ React.createElement("div", { className: "p-3 text-xs italic opacity-60" }, "No existing parties found."))), form.isDeceased && /* @__PURE__ */ React.createElement("div", { className: "col-span-6 bg-teastain p-4 border border-sepia/50 rounded-sm mt-2 shadow-inner flex flex-col gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest font-mono" }, "Obituary / Date of Death Notes (Fountain Pen)"), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      className: "w-full border-b-[1.5px] border-sepia/30 p-2 bg-transparent outline-none h-20 text-xl text-fountain resize-none",
      style: { fontFamily: '"Homemade Apple", cursive', lineHeight: "1.5" },
      value: form.obituary || "",
      onChange: (e) => setForm({ ...form, obituary: e.target.value }),
      placeholder: "e.g. Died intestate Oct 4th, 1912..."
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest font-mono" }, "Reference Hyperlink (Optional)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "url",
      className: "w-full border-b-[1.5px] border-sepia/30 p-2 bg-transparent outline-none text-sm text-fountain font-mono",
      value: form.graveyardLink || "",
      onChange: (e) => setForm({ ...form, graveyardLink: e.target.value }),
      placeholder: "https://..."
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "File Date (H)"), /* @__PURE__ */ React.createElement("input", { type: "date", className: "w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  text-sm", value: form.fileDate, onChange: (e) => setForm({ ...form, fileDate: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Inst/Eff Date (I)"), /* @__PURE__ */ React.createElement("input", { type: "date", className: "w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  text-sm", value: form.date, onChange: (e) => setForm({ ...form, date: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-6" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Land Description (L)"), /* @__PURE__ */ React.createElement("textarea", { className: "w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  h-16 text-sm", value: form.landDesc, onChange: (e) => setForm({ ...form, landDesc: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-6" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold uppercase mb-1.5 block tracking-wider text-sepia/80" }, "Remarks (M)"), /* @__PURE__ */ React.createElement("textarea", { className: "w-full border border-ink rounded-sm p-3 bg-parchment focus:ring-2 focus:ring-sepia outline-none  h-14 text-sm", value: form.remarks, onChange: (e) => setForm({ ...form, remarks: e.target.value }) })), (modalMode === "convey" || modalMode === "attach" && attachType === "conveyance") && (() => {
    const parentForMath = nodes.find((n) => n.id === (modalMode === "attach" ? attachParentId : activeNode?.id));
    return /* @__PURE__ */ React.createElement("div", { className: "col-span-6 bg-parchment border border-ink rounded-sm p-6  relative overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 w-1.5 h-full bg-sepia" }), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-6 pl-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black uppercase tracking-widest flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "Cpu", size: 16 }), " Math Engine"), /* @__PURE__ */ React.createElement("div", { className: "flex bg-teastain p-1 border border-ink" }, ["fraction", "all", "fixed"].map((m) => /* @__PURE__ */ React.createElement("button", { key: m, onClick: () => setForm({ ...form, conveyanceMode: m }), className: `px-4 py-1.5 text-[10px] font-bold uppercase transition-all ${form.conveyanceMode === m ? "bg-ink text-parchment" : "text-ink hover:bg-ink/10"}` }, m)))), form.conveyanceMode === "fraction" && /* @__PURE__ */ React.createElement("div", { className: "mb-6 pl-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold opacity-70 uppercase tracking-widest block mb-2" }, "Select Calculation Basis"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setForm({ ...form, splitBasis: "whole" }), className: `p-3 border text-left transition-all ${form.splitBasis === "whole" ? "bg-ink text-parchment border-ink" : "bg-parchment border-ink text-ink hover:bg-ink/10"}` }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold uppercase mb-1" }, "Whole Tract"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs opacity-80" }, "1.00000000")), /* @__PURE__ */ React.createElement("button", { onClick: () => setForm({ ...form, splitBasis: "initial" }), className: `p-3 border text-left transition-all ${form.splitBasis === "initial" ? "bg-ink text-parchment border-ink" : "bg-parchment border-ink text-ink hover:bg-ink/10"}` }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold uppercase mb-1" }, "Original Granted"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs opacity-80" }, formatFraction(parentForMath?.initialFraction ?? parentForMath?.fraction))), /* @__PURE__ */ React.createElement("button", { onClick: () => setForm({ ...form, splitBasis: "remaining" }), className: `p-3 border text-left transition-all ${form.splitBasis === "remaining" ? "bg-ink text-parchment border-ink" : "bg-parchment border-ink text-ink hover:bg-ink/10"}` }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold uppercase mb-1" }, "Remaining Share"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs opacity-80" }, formatFraction(parentForMath?.fraction))))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-teastain p-5 border border-ink ml-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 w-full sm:w-auto" }, form.conveyanceMode === "fraction" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("div", { className: "text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0" }, "Numerator"), /* @__PURE__ */ React.createElement("input", { type: "number", className: "w-20 p-3 text-center font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner", value: form.numerator === 0 ? "" : form.numerator, placeholder: "1", onFocus: (e) => e.target.select(), onChange: (e) => setForm({ ...form, numerator: e.target.value }) })), /* @__PURE__ */ React.createElement("span", { className: "font-black text-ink opacity-40 text-2xl pt-2" }, "/"), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("div", { className: "text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0" }, "Denominator"), /* @__PURE__ */ React.createElement("input", { type: "number", className: `w-24 p-3 text-center font-bold border bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner ${parseFloat(form.denominator) <= 0 ? "border-stamp text-stamp" : "border-ink"}`, value: form.denominator === 0 ? "" : form.denominator, placeholder: "2", onFocus: (e) => e.target.select(), onChange: (e) => setForm({ ...form, denominator: e.target.value }) }), parseFloat(form.denominator) <= 0 && /* @__PURE__ */ React.createElement("div", { className: "absolute -bottom-5 left-0 text-[9px] text-stamp font-bold whitespace-nowrap" }, "Denominator must be > 0"))), form.conveyanceMode === "fixed" && /* @__PURE__ */ React.createElement("div", { className: "relative w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[8px] font-bold opacity-60 uppercase absolute -top-4 left-0" }, "Fixed Decimal Amount"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.0000000001", className: "w-full sm:w-48 p-3 font-mono font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner", value: form.manualAmount === 0 ? "" : form.manualAmount, placeholder: "0.000", onFocus: (e) => e.target.select(), onChange: (e) => setForm({ ...form, manualAmount: e.target.value }) })), form.conveyanceMode === "all" && /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold bg-ink text-parchment px-4 py-2 border border-ink" }, "Transferring 100% of Balance")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:items-end gap-3 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement("div", { className: "text-left sm:text-right" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold uppercase text-sepia mb-0.5 tracking-widest" }, "To Be Conveyed"), /* @__PURE__ */ React.createElement("div", { className: "text-2xl font-black font-mono tracking-tight" }, formatFraction(calcShare))), /* @__PURE__ */ React.createElement("div", { className: `px-4 py-2 border text-left sm:text-right transition-colors ${parentForMath?.fraction - calcShare < -FRACTION_EPSILON ? "bg-[#E0D7D7] border-stamp/50" : "bg-parchment border-ink "}` }, /* @__PURE__ */ React.createElement("div", { className: `text-[9px] font-black uppercase tracking-widest mb-1 ${parentForMath?.fraction - calcShare < -FRACTION_EPSILON ? "text-stamp" : "opacity-60"}` }, "Grantor Retention Balance"), /* @__PURE__ */ React.createElement("div", { className: `font-mono text-xs flex items-center sm:justify-end gap-2 ${parentForMath?.fraction - calcShare < -FRACTION_EPSILON ? "text-stamp font-bold" : ""}` }, /* @__PURE__ */ React.createElement("span", null, formatFraction(parentForMath?.fraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "-"), /* @__PURE__ */ React.createElement("span", null, formatFraction(calcShare)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "="), /* @__PURE__ */ React.createElement("span", { className: `text-sm border-l border-ink pl-2 ${parentForMath?.fraction - calcShare < -FRACTION_EPSILON ? "text-stamp" : "font-bold"}` }, formatFraction(parentForMath?.fraction - calcShare)))))));
  })(), modalMode === "precede" && /* @__PURE__ */ React.createElement("div", { className: "col-span-6 bg-parchment border border-ink rounded-sm p-6 relative overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 w-1.5 h-full bg-sepia" }), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-6 pl-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black uppercase tracking-widest flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "ArrowUp", size: 16 }), " Predecessor Math Engine")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-start justify-between gap-6 bg-teastain p-5 border border-ink ml-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase tracking-widest block mb-2" }, "Predecessor Total Interest Received"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      step: "0.0000000001",
      className: "w-full sm:w-64 p-3 font-mono font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner",
      value: form.initialFraction === 0 ? "" : form.initialFraction,
      onFocus: (e) => e.target.select(),
      onChange: (e) => setForm({ ...form, initialFraction: parseFloat(e.target.value) || 0 })
    }
  ), /* @__PURE__ */ React.createElement("p", { className: "text-[9px] opacity-60 mt-2 font-mono uppercase tracking-wider max-w-[250px]" }, "The amount the newly discovered predecessor originally acquired.")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:items-end gap-3 w-full sm:w-auto mt-4 sm:mt-0" }, /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest mb-1 opacity-60" }, "Succession Deduction"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs flex items-center sm:justify-end gap-2" }, /* @__PURE__ */ React.createElement("span", { title: "Predecessor Interest" }, formatFraction(precedeImpact?.newInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "-"), /* @__PURE__ */ React.createElement("span", { title: "Successor Interest (Current Record)" }, formatFraction(precedeImpact?.oldInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "="), /* @__PURE__ */ React.createElement("span", { className: "text-sm border-l border-ink pl-2 font-bold text-sepia" }, formatFraction(precedeImpact?.predecessorRetained)))), /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest mb-1 opacity-60" }, "Branch Scale Preview"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs flex items-center sm:justify-end gap-2" }, /* @__PURE__ */ React.createElement("span", null, formatFraction(precedeImpact?.oldInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "\u2192"), /* @__PURE__ */ React.createElement("span", null, formatFraction(precedeImpact?.newInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "(x"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, precedeImpact?.scaleFactor?.toFixed(6)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, ")"))), /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest mb-1 opacity-60" }, "Parent Balance Preview"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs flex items-center sm:justify-end gap-2" }, /* @__PURE__ */ React.createElement("span", null, formatFraction(precedeImpact?.parentBefore)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "\u2192"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, formatFraction(precedeImpact?.parentAfter)))), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase font-bold text-sepia/60 tracking-widest" }, "Descendants Updated: ", precedeImpact?.descendantCount || 0)))), modalMode === "rebalance" && /* @__PURE__ */ React.createElement("div", { className: "col-span-6 bg-parchment border border-ink rounded-sm p-6 relative overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 w-1.5 h-full bg-fountain" }), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-6 pl-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black uppercase tracking-widest flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "Adjust", size: 16 }), " Branch Rebalance Engine")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-start justify-between gap-6 bg-teastain p-5 border border-ink ml-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase tracking-widest block mb-2" }, "Corrected Root Interest for this Branch"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      step: "0.0000000001",
      className: "w-full sm:w-64 p-3 font-mono font-bold border border-ink bg-parchment focus:ring-2 focus:ring-sepia outline-none text-lg shadow-inner",
      value: form.initialFraction === 0 ? "" : form.initialFraction,
      onFocus: (e) => e.target.select(),
      onChange: (e) => setForm({ ...form, initialFraction: parseFloat(e.target.value) || 0 })
    }
  ), /* @__PURE__ */ React.createElement("p", { className: "text-[9px] opacity-60 mt-2 font-mono uppercase tracking-wider max-w-[320px]" }, "Rebalance this record and every descendant proportionally without inserting a predecessor record.")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:items-end gap-3 w-full sm:w-auto mt-4 sm:mt-0" }, /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest mb-1 opacity-60" }, "Branch Scale Preview"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs flex items-center sm:justify-end gap-2" }, /* @__PURE__ */ React.createElement("span", null, formatFraction(rebalanceImpact?.oldInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "\u2192"), /* @__PURE__ */ React.createElement("span", null, formatFraction(rebalanceImpact?.newInitialFraction)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "(x"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, rebalanceImpact?.scaleFactor?.toFixed(6)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, ")"))), /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border bg-parchment border-ink text-left sm:text-right w-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest mb-1 opacity-60" }, "Parent Balance Preview"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-xs flex items-center sm:justify-end gap-2" }, /* @__PURE__ */ React.createElement("span", null, formatFraction(rebalanceImpact?.parentBefore)), /* @__PURE__ */ React.createElement("span", { className: "opacity-40" }, "\u2192"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, formatFraction(rebalanceImpact?.parentAfter)))), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] uppercase font-bold text-sepia/60 tracking-widest" }, "Descendants Updated: ", rebalanceImpact?.descendantCount || 0)))), (modalMode === "edit" || modalMode === "add_chain") && form.type !== "related" && form.parentId !== "unlinked" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest" }, "Initial Granted Share ", modalMode === "edit" ? "(Rebalances branch)" : ""), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.0000000001", className: "w-full border border-ink p-3 bg-teastain font-bold focus:ring-2 focus:ring-sepia outline-none", value: form.initialFraction === 0 ? "" : form.initialFraction, onFocus: (e) => e.target.select(), onChange: (e) => setForm({ ...form, initialFraction: parseFloat(e.target.value) || 0 }) })), /* @__PURE__ */ React.createElement("div", { className: "col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-sepia uppercase mb-1.5 block tracking-widest" }, "Remaining Retained Share ", /* @__PURE__ */ React.createElement("span", { className: "normal-case text-sepia/60" }, "(derived \xB7 read-only)")), /* @__PURE__ */ React.createElement("div", { className: "w-full border border-ink/40 p-3 bg-teastain/50 font-bold font-mono text-sm text-sepia/80 select-none" }, formatFraction(activeNode?.fraction ?? form.fraction)))), /* @__PURE__ */ React.createElement("div", { className: "col-span-6 pt-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 p-4 border border-dashed border-ink bg-teastain hover:bg-[#D9D1BF] transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "bg-teastain p-3 border border-sepia/30" }, /* @__PURE__ */ React.createElement(Icon, { name: "Upload", size: 20 })), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-bold text-sepia/80" }, "Vault PDF Link"), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-sepia/60 mt-0.5" }, "Uploading automatically populates the Inst No. field.")), /* @__PURE__ */ React.createElement("input", { type: "file", ref: modalUploadRef, onChange: handleDocSelection, accept: ".pdf", className: "hidden" }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, form.docData && /* @__PURE__ */ React.createElement("button", { onClick: () => setViewerData(form.docData), className: "px-4 py-2 bg-teastain border border-ink font-bold text-xs hover:border-sepia hover:text-sepia flex items-center gap-2 transition-colors" }, /* @__PURE__ */ React.createElement(Icon, { name: "Eye", size: 14 }), " View"), /* @__PURE__ */ React.createElement("button", { onClick: () => modalUploadRef.current.click(), className: "px-6 py-2 bg-sepia/10 text-sepia border border-sepia/40 font-bold uppercase text-xs hover:bg-sepia/20 transition-all tracking-widest" }, "Browse")))))), /* @__PURE__ */ React.createElement("div", { className: "p-6 bg-parchment border-t border-ink flex gap-4" }, /* @__PURE__ */ React.createElement("button", { onClick: handleCommit, className: `flex-1 py-4 text-parchment font-black uppercase tracking-widest transition-all border border-ink hover:-translate-y-0.5 ${modalMode === "edit" ? "bg-ink" : modalMode === "add_related" ? "bg-fountain" : modalMode === "attach" ? "bg-fountain" : modalMode === "precede" ? "bg-ink" : modalMode === "rebalance" ? "bg-fountain" : modalMode === "add_unlinked" ? "bg-fountain" : modalMode === "add_chain" ? "bg-fountain" : "bg-sepia"}` }, "Commit ", modalMode === "add_related" ? "Document" : modalMode === "attach" ? "Linked Record" : modalMode === "precede" ? "Predecessor" : modalMode === "rebalance" ? "Rebalance" : modalMode === "add_unlinked" ? "Loose Record" : modalMode === "add_chain" ? "New Chain" : "Transaction"), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowModal(false), className: "px-10 py-4 bg-teastain border border-ink hover:border-stamp hover:text-stamp font-bold uppercase tracking-widest transition-colors hover:-translate-y-0.5" }, "Cancel")))), confirmAction && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-ink/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in font-mono text-ink no-print" }, /* @__PURE__ */ React.createElement("div", { className: "bg-parchment border border-stamp/40 p-8 ink-shadow-lg max-w-sm w-full text-center animate-slide-up" }, /* @__PURE__ */ React.createElement("div", { className: "text-stamp flex items-center justify-center mx-auto mb-4 border border-stamp/50 w-16 h-16 bg-stamp/10" }, /* @__PURE__ */ React.createElement(Icon, { name: "Trash", size: 32 })), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-serif font-black mb-2 text-stamp" }, confirmAction.title), /* @__PURE__ */ React.createElement("p", { className: "text-sm opacity-70 mb-8 leading-relaxed" }, confirmAction.message), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setConfirmAction(null), className: "flex-1 py-3 border border-ink bg-teastain hover:bg-ink hover:text-parchment font-bold transition-colors uppercase tracking-widest text-xs " }, "Cancel"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    confirmAction.onConfirm();
    setConfirmAction(null);
  }, className: "flex-1 py-3 border border-stamp/50 bg-stamp/20 text-stamp font-bold hover:bg-stamp/30 transition-colors uppercase tracking-widest text-xs" }, confirmAction.actionText)))), viewerData && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-ink/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in font-mono no-print" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-7xl h-full flex flex-col bg-parchment border border-ink ink-shadow-lg" }, /* @__PURE__ */ React.createElement("div", { className: "bg-teastain p-4 text-sepia flex justify-between items-center border-b border-ink" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "border border-ink p-2 bg-parchment" }, /* @__PURE__ */ React.createElement(Icon, { name: "FileText", size: 20 })), /* @__PURE__ */ React.createElement("span", { className: "text-base font-serif font-black tracking-tight uppercase text-sepia" }, "Vault Viewport")), /* @__PURE__ */ React.createElement("button", { onClick: () => setViewerData(null), className: "p-2 border border-transparent hover:border-ink transition-colors" }, /* @__PURE__ */ React.createElement(Icon, { name: "Close", size: 20 }))), /* @__PURE__ */ React.createElement("object", { data: viewerData, type: "application/pdf", className: "w-full h-full border-none bg-[#111d2d]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center h-full p-20 text-center bg-teastain text-ink" }, /* @__PURE__ */ React.createElement(Icon, { name: "FileText", size: 48, className: "opacity-50 mb-4" }), /* @__PURE__ */ React.createElement("p", { className: "opacity-70 mb-6 font-bold" }, "Your browser does not support inline PDFs."), /* @__PURE__ */ React.createElement("a", { href: viewerData, target: "_blank", className: "bg-ink text-parchment px-8 py-3 border border-ink font-bold transition-colors " }, "Open External Tab")))))));
};
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ React.createElement(App, null));
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
