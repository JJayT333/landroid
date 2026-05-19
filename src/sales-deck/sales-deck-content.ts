import changelogMarkdown from '../../CHANGELOG.md?raw';
import continuationMarkdown from '../../CONTINUATION-PROMPT.md?raw';
import deploymentMarkdown from '../../DEPLOYMENT_STATE.md?raw';
import roadmapMarkdown from '../../ROADMAP.md?raw';

export interface SalesDeckSlide {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  points: string[];
  stat?: {
    label: string;
    value: string;
    detail: string;
  };
  footer?: string;
}

interface SalesDeckSources {
  changelog: string;
  continuation: string;
  deployment: string;
  roadmap: string;
}

const defaultSources: SalesDeckSources = {
  changelog: changelogMarkdown,
  continuation: continuationMarkdown,
  deployment: deploymentMarkdown,
  roadmap: roadmapMarkdown,
};

export const salesDeckSlides = buildSalesDeckSlides(defaultSources);

export function buildSalesDeckSlides(sources: SalesDeckSources): SalesDeckSlide[] {
  const recentProgress = extractFirstBulletsFromSection(sources.changelog, '2026-05-19', 5);
  const likelyNext = extractFirstBulletsFromSection(
    sources.continuation,
    'Likely Next Steps',
    4
  );
  const openRisks = extractFirstBulletsFromSection(
    sources.continuation,
    'Open Risks And Assumptions',
    3
  );
  const roadmapNow = extractFirstBulletsFromSection(sources.roadmap, 'Now', 4);
  const deploymentStatus = extractDeploymentStatus(sources.deployment);

  return [
    {
      id: 'overview',
      eyebrow: 'Overview',
      title: 'LANDroid is a working title and lease review cockpit',
      summary:
        'The app now combines title-tree mapping, leasehold review, document registry work, map references, research records, and hosted AI scaffolding in one signed-in workspace.',
      points: [
        'Texas oil-and-gas title math is the active production baseline.',
        'Desk Map remains the title source of truth; Leasehold consumes it for acreage, royalty, ORRI, WI, NPRI, and transfer-order review.',
        'The hosted POC gives the product a real review environment while preserving local-first workspace behavior.',
      ],
      stat: {
        label: 'Active surfaces',
        value: '11',
        detail: 'Desk Map, Leasehold, Documents, Owners, Maps, AI, and more',
      },
    },
    {
      id: 'problem',
      eyebrow: 'Workflow Pain',
      title: 'Land review breaks when evidence, math, and status live apart',
      summary:
        'A landman has to reconcile county instruments, title corrections, lease economics, packet evidence, and stakeholder-ready explanations without losing auditability.',
      points: [
        'Spreadsheets are flexible, but they hide provenance and make title corrections hard to review.',
        'Static maps and runsheets do not explain how ownership math changed.',
        'Document packets, owner files, curative issues, and AI notes need shared context before they can be trusted.',
      ],
    },
    {
      id: 'surface',
      eyebrow: 'Current Product',
      title: 'The POC is now broad enough to show real workflow gravity',
      summary:
        'LANDroid is no longer a single calculation tool. It is a connected workspace with distinct surfaces for title, leasehold, documents, maps, research, and presentation.',
      points: [
        'Workspace replacement flows now reset related side stores so demos and imports do not carry stale records forward.',
        'The Documents registry is the first-class place for saved PDF metadata, duplicate surfacing, linked entities, and packet manifests.',
        'The signed-in deck area can now evolve inside the app instead of depending only on an external PowerPoint.',
      ],
      footer: 'Native slides are generated from a small helper so this deck can be refreshed without redesigning the view.',
    },
    {
      id: 'desk-map',
      eyebrow: 'Desk Map',
      title: 'Desk Map shows the title story as a living, auditable tree',
      summary:
        'The current Desk Map workflow supports tract/unit focus, branch corrections, document chips, owner/lease linkage, formula review, and visual context from Maps.',
      points: [
        'Fit centers the visible title tree instead of the padded canvas container.',
        'Formula hover remains quick-glance; click-to-pin adds side-by-side comparison in the Formula Tray.',
        'Attach Related Document can create metadata and upload a PDF through the existing document path in one flow.',
      ],
    },
    {
      id: 'leasehold',
      eyebrow: 'Leasehold',
      title: 'Leasehold keeps payout review separate from title-chain editing',
      summary:
        'Leasehold consumes Desk Map and Owners data to review units, tracts, leases, NPRIs, ORRIs, assignments, retained WI, and transfer-order readiness.',
      points: [
        'Unit Focus is the math boundary for multi-unit demos and future work.',
        'Overview, Map, and Deck modes separate acreage review, hierarchy, and transfer-order checks.',
        'Malformed leasehold inputs surface as warnings and are excluded as zero until corrected.',
      ],
    },
    {
      id: 'documents',
      eyebrow: 'Documents',
      title: 'The document registry is becoming the trust layer',
      summary:
        'PDFs and related records are first-class workspace assets, not disposable card decorations.',
      points: [
        'Document blobs and attachment links are workspace-scoped in IndexedDB.',
        'Detach removes a specific entity link; shared document blobs remain until no links survive.',
        'The next registry direction is packet export, saved views, duplicate cleanup, OCR/search, and cited read-only AI document query.',
      ],
    },
    {
      id: 'ai',
      eyebrow: 'AI Direction',
      title: 'AI is useful only when it stays contextual, reviewable, and gated',
      summary:
        'The hosted path now sends a compact read-only app packet with signed-in chat requests, while mutating local AI work remains approval-gated.',
      points: [
        'Hosted chat posts directly to the Lambda-backed `/api/ai/chat/completions` proxy with Cognito auth.',
        'The AI context packet includes active view, project, unit/tract, visible Desk Map cards, lease summaries, and coverage totals.',
        'Mutating AI tools create pending proposals that require user approval before state changes apply.',
      ],
    },
    {
      id: 'hosted',
      eyebrow: 'Hosted POC',
      title: 'The hosted POC has a clear deploy boundary',
      summary:
        'Frontend changes ride Amplify from `main`; Lambda AI proxy changes still require a manual bundle/upload until deployment automation lands.',
      points: deploymentStatus,
      stat: {
        label: 'Production URL',
        value: 'landroid.abstractmapping.com',
        detail: 'Amplify frontend with Cognito sign-in and Lambda AI proxy rewrite',
      },
    },
    {
      id: 'recent-progress',
      eyebrow: 'Recent Progress',
      title: 'Recent work tightened reset safety, hosted AI context, and deck readiness',
      summary:
        'This slide pulls from `CHANGELOG.md` so it can keep tracking meaningful changes without editing the component copy.',
      points: recentProgress.length > 0 ? recentProgress : roadmapNow,
      footer: 'Source: CHANGELOG.md, latest 2026-05-19 section.',
    },
    {
      id: 'next',
      eyebrow: 'Next Milestones',
      title: 'The near-term path is document trust, import hardening, and hosted verification',
      summary:
        'The next steps combine the active handoff with the roadmap so the deck can serve as a status snapshot.',
      points: [...likelyNext, ...openRisks].slice(0, 6),
      footer: 'Source: CONTINUATION-PROMPT.md and ROADMAP.md.',
    },
  ];
}

export function extractFirstBulletsFromSection(
  markdown: string,
  heading: string,
  limit: number
): string[] {
  const section = extractSection(markdown, heading);
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => cleanMarkdownText(line.slice(2)))
    .filter(Boolean)
    .slice(0, limit);
}

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{2,3}\\s+${escapeRegExp(heading)}\\s*$`, 'i');
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startIndex < 0) return '';

  const startLevel = headingLevel(lines[startIndex]);
  const endIndex = lines.findIndex((line, index) => {
    if (index <= startIndex) return false;
    const level = headingLevel(line);
    return level > 0 && level <= startLevel;
  });

  return lines.slice(startIndex + 1, endIndex < 0 ? undefined : endIndex).join('\n');
}

function extractDeploymentStatus(markdown: string): string[] {
  const frontend = extractFirstBulletsFromSection(markdown, 'Frontend', 3);
  const aiProxy = extractFirstBulletsFromSection(markdown, 'AI Proxy', 3);
  const verification = extractFirstBulletsFromSection(markdown, 'Verification', 1);
  return [...frontend, ...aiProxy, ...verification].slice(0, 5);
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingLevel(line: string): number {
  const match = line.match(/^(#{1,6})\s+/);
  return match ? match[1].length : 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
