import { expect, type Locator, type Page, test } from '@playwright/test';

const LOAD_DEMO_CONFIRMATION_TEXT = 'LOAD DEMO';
const LOAD_WORKSPACE_CONFIRMATION_TEXT = 'LOAD WORKSPACE';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Desk Map' })).toBeVisible();
}

/**
 * Load the combinatorial demo through the Navbar's Demo Data dropdown.
 * The leasehold and stress demos were retired in Phase 3 — only the
 * combinatorial fixture remains. Phase 4 is rebuilding the deeper workflow
 * assertions against the current 10-tract Raven Forest fixture.
 */
async function loadCombinatorialDemo(page: Page) {
  await page.getByRole('button', { name: /Demo Data/ }).click();
  await page
    .getByRole('menuitem', { name: /Combinatorial/ })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Load Combinatorial Demo?' })
  ).toBeVisible();
  await page
    .getByLabel(`Type ${LOAD_DEMO_CONFIRMATION_TEXT} to confirm`)
    .fill(LOAD_DEMO_CONFIRMATION_TEXT);
  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  await expect(page.getByText(/Combinatorial Demo — /)).toBeVisible({
    timeout: 45_000,
  });
}

async function selectDeskMapTab(page: Page, name: string | RegExp) {
  const tab = page.getByRole('tab', { name }).first();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function labeledControl(root: Locator, label: string, control: string) {
  const textNode = root.getByText(label, { exact: true }).first();
  await expect(textNode).toBeVisible();

  const ancestorLabelControl = textNode
    .locator('xpath=ancestor::label[1]')
    .locator(control)
    .first();
  if (await ancestorLabelControl.count()) {
    return ancestorLabelControl;
  }

  const parentControl = textNode.locator('xpath=..').locator(control).first();
  if (await parentControl.count()) {
    return parentControl;
  }

  const grandparentControl = textNode
    .locator('xpath=../..')
    .locator(control)
    .first();
  if (await grandparentControl.count()) {
    return grandparentControl;
  }

  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  const exactLabels = root.locator('label').filter({ hasText: exactText });
  const exactCount = await exactLabels.count();

  for (let index = 0; index < exactCount; index += 1) {
    const labelNode = exactLabels.nth(index);
    const nested = labelNode.locator(control).first();
    if (await nested.count()) {
      return nested;
    }

    const parentControl = labelNode.locator('xpath=..').locator(control).first();
    if (await parentControl.count()) {
      return parentControl;
    }
  }

  const prefixedLabels = root
    .locator('label')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) });
  const prefixedCount = await prefixedLabels.count();

  for (let index = 0; index < prefixedCount; index += 1) {
    const controlNode = prefixedLabels.nth(index).locator(control).first();
    if (await controlNode.count()) {
      return controlNode;
    }
  }

  const textNodes = root.getByText(label, { exact: true });
  const textCount = await textNodes.count();

  for (let index = 0; index < textCount; index += 1) {
    const parentControl = textNodes.nth(index).locator('xpath=..').locator(control).first();
    if (await parentControl.count()) {
      return parentControl;
    }
  }

  throw new Error(`No ${control} found for label "${label}"`);
}

async function fillInput(root: Locator, label: string, value: string) {
  await (await labeledControl(root, label, 'input')).fill(value);
}

async function fillTextArea(root: Locator, label: string, value: string) {
  await (await labeledControl(root, label, 'textarea')).fill(value);
}

async function selectExact(root: Locator, label: string, optionLabel: string) {
  await (await labeledControl(root, label, 'select')).selectOption({
    label: optionLabel,
  });
}

async function selectFirstLinkedOption(root: Locator, label: string) {
  const select = await labeledControl(root, label, 'select');
  const value = await select.evaluate((element) => {
    const selectElement = element as HTMLSelectElement;
    return Array.from(selectElement.options).find((option) => option.value)
      ?.value ?? '';
  });
  expect(value, `${label} should have at least one linkable option`).not.toBe('');
  await select.selectOption(value);
  return value;
}

async function checkLinkedRecord(root: Locator, recordText: string) {
  await root
    .locator('label')
    .filter({ hasText: recordText })
    .locator('input[type="checkbox"]')
    .check();
}

function isoDateOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('combinatorial demo loads with desk-map cards and PDF chips', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await expect(page.getByText(/Combinatorial Demo — /)).toBeVisible();
  await expect(page.getByText(/^\d+ cards$/).first()).toBeVisible();
  await expect(
    page.locator('button[data-attachment-id][title^="View attached PDF:"]').first()
  ).toBeVisible();
  // Present-owner status now shows as a sky card tint + retained-interest gold
  // dot instead of a "Present Owner" pill — assert at least one retained-interest
  // marker rendered on a combinatorial desk-map card.
  await expect(page.locator('[title^="Present owner"]').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('multi-document chips open the correct seeded PDFs by attachment id', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await selectDeskMapTab(page, 'C2 — Probate & Heirship');

  const seededChipNames = [
    /C2-ST-\d+-deed\.pdf/,
    /C2-ST-\d+-obituary\.pdf/,
    /C2-ST-\d+-affidavit-of-heirship\.pdf/,
  ];

  for (const namePattern of seededChipNames) {
    const chip = page
      .locator('button[data-attachment-id][title^="View attached PDF:"]')
      .filter({ hasText: namePattern })
      .first();
    await expect(chip).toBeVisible();
    const attachmentId = await chip.getAttribute('data-attachment-id');
    expect(attachmentId).toBeTruthy();
    const chipByAttachment = page.locator(
      `button[data-attachment-id="${attachmentId}"]`
    );
    const chipText = (await chipByAttachment.innerText()).replace(/\s+/g, ' ');
    await chipByAttachment.click();
    const fileName = chipText.replace(/^PDF\s+/, '');
    await expect(page.getByRole('dialog', { name: fileName })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: fileName })).toBeHidden();
  }

  expect(browserErrors).toEqual([]);
});

test('document registry edits metadata and previews a selected packet', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await page.getByRole('button', { name: 'Documents' }).click();
  const documentsShell = page.locator('main').first();
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Document saved views' })
  ).toBeVisible();
  await expect(page.getByText(/145 docs/)).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Runsheet / Mineral Title' }).click();

  const firstCheckbox = documentsShell.locator('tbody input[type="checkbox"]').first();
  const firstDocumentRow = firstCheckbox.locator('xpath=ancestor::tr[1]');
  await expect(firstCheckbox).toBeVisible();
  await expect(firstDocumentRow).toBeVisible();
  await firstDocumentRow.click();

  await fillInput(documentsShell, 'Display title', 'Registry packet smoke deed');
  await selectExact(documentsShell, 'Area', 'Runsheet / Mineral Title');
  await fillInput(documentsShell, 'County', 'Walker');
  await fillInput(documentsShell, 'State', 'TX');
  await fillInput(documentsShell, 'Instrument no.', 'DOC-REG-001');
  await fillInput(documentsShell, 'Instrument', '2026-05-16');
  await fillInput(documentsShell, 'Grantor', 'Registry Grantor');
  await fillInput(documentsShell, 'Grantee', 'Registry Grantee');
  await fillInput(documentsShell, 'Lessor', 'Registry Lessor');
  await fillInput(documentsShell, 'Lessee', 'Registry Lessee');
  await fillInput(documentsShell, 'Source ref', 'E2E packet source');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Metadata saved.')).toBeVisible();

  await expect(page.getByText('Registry packet smoke deed').first()).toBeVisible();
  await page.getByLabel('Select Registry packet smoke deed').check();
  await page.getByRole('button', { name: 'Packet: Selected' }).click();

  const packetSection = documentsShell.locator('section').filter({
    hasText: 'Packet Preview',
  });
  await expect(packetSection.getByText('Registry packet smoke deed')).toBeVisible();
  await expect(packetSection.getByText('Unique')).toBeVisible();
  await expect(packetSection.getByText('Ready')).toBeVisible();
  await expect(packetSection.getByText('E2E packet source')).toBeVisible();
  await expect(packetSection.getByRole('button', { name: 'Manifest JSON' })).toBeEnabled();
  await expect(page.getByText('Linked Entities')).toBeVisible();
  await expect(page.getByText('Duplicate Status')).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('project name is inline-editable from the Navbar', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await page.getByRole('button', { name: /Project name:/ }).click();

  const input = page.getByRole('textbox', { name: 'Project name' });
  await expect(input).toBeVisible();
  await input.fill('Raven Forest Review');
  await input.press('Enter');

  await expect(
    page.getByRole('button', { name: /Project name: Raven Forest Review/ })
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('leasehold seed keeps PDF filenames visible and owner leases branch-aware', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);

  await expect(page.getByText('Raven Forest Unit A').first()).toBeVisible();
  await expect(page.getByText('Raven Forest Unit B').first()).toBeVisible();
  await expect(page.getByText('C10 — Kitchen Sink').first()).toBeVisible();
  await expect(
    page.locator('[title="View attached PDF: 09-6968.pdf"]').first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF 09-6968.pdf' })).toBeVisible();
  await expect(page.getByText('Lessor: Charlotte Whitaker')).toBeVisible();
  await expect(
    page.getByText('Lease: C1 — Baseline Splits — Charlotte Whitaker Lease')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Leasehold' }).click();
  await expect(
    page.getByText(/Raven Forest Unit A is isolated here/)
  ).toBeVisible();
  await expect(page.getByText('Texas Energy Acquisitions LP').first()).toBeVisible();

  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByText('Leasehold Map').first()).toBeVisible();
  await page.getByRole('button', { name: /C1 C1 — Baseline Splits/ }).click();
  await expect(page.getByText('Tract Focus').first()).toBeVisible();
  await expect(
    page.getByText('C1 — Baseline Splits — Olivia Whitaker Lease')
  ).toBeVisible();
  await expect(page.getByText(/Doc# ST-10072/)).toBeVisible();
  await expect(
    page.getByText('C1 — Baseline Splits — Paul Whitaker Lease')
  ).toBeVisible();
  await expect(page.getByText(/Doc# ST-10073/)).toBeVisible();
  await expect(
    page.getByText('C1 — Baseline Splits — Peter Whitaker Lease')
  ).toBeVisible();
  await expect(page.getByText(/Doc# ST-10074/)).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('landroid export/import preserves v8 document chips and same-owner records', async ({
  page,
}, testInfo) => {
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);

  await selectDeskMapTab(page, 'C2 — Probate & Heirship');
  await expect(page.getByText(/C2-ST-\d+-affidavit-of-heirship\.pdf/)).toBeVisible();

  await page.getByRole('button', { name: 'File ▾' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Save workspace' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('raven-forest-v8.landroid');
  await download.saveAs(downloadPath);

  await page
    .locator('input[type="file"][accept=".landroid,.csv"]')
    .setInputFiles(downloadPath);
  await expect(
    page.getByRole('dialog', { name: /Load raven-forest-v8\.landroid\?/ })
  ).toBeVisible();
  await page
    .getByLabel(`Type ${LOAD_WORKSPACE_CONFIRMATION_TEXT} to confirm`)
    .fill(LOAD_WORKSPACE_CONFIRMATION_TEXT);
  await page.getByRole('button', { name: 'Replace Workspace' }).click();

  await expect(page.getByText(/Combinatorial Demo — Raven Forest/)).toBeVisible();
  // Imported multi-unit workspaces resolve the active Unit A tract to C1 after
  // normalization. Wait for that import pass before retargeting C2.
  await expect(
    page.getByRole('tab', { name: /C1 — Baseline Splits/ })
  ).toHaveAttribute('aria-selected', 'true');
  await selectDeskMapTab(page, 'C2 — Probate & Heirship');
  await expect(page.getByText(/C2-ST-\d+-deed\.pdf/)).toBeVisible();
  await expect(page.getByText(/C2-ST-\d+-obituary\.pdf/)).toBeVisible();
  await expect(page.getByText(/C2-ST-\d+-affidavit-of-heirship\.pdf/)).toBeVisible();
  await page.getByRole('button', { name: 'Owners' }).click();
  const ownersShell = page.locator('main').first();
  await fillInput(ownersShell, 'Search', 'Charlotte Whitaker');
  await page.getByRole('button', { name: /Charlotte Whitaker/ }).click();
  await page.getByRole('tab', { name: 'Leases' }).click();
  await expect(
    page.getByText('C1 — Baseline Splits — Charlotte Whitaker Lease')
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('deleting a branch-scoped lessee card removes only that owner lease', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);

  await expect(page.getByText('Lessor: Charlotte Whitaker')).toBeVisible();
  await expect(page.getByText('Lessor: Olivia Whitaker')).toBeVisible();

  await page.getByRole('button', { name: 'Collapse toolbar' }).click();
  const leaseCard = page
    .locator('div.group')
    .filter({ hasText: 'Lessor: Charlotte Whitaker' })
    .filter({ hasText: 'Texas Energy Acquisitions LP' })
    .first();
  await leaseCard.hover();
  await leaseCard.getByRole('button', { name: 'DELETE' }).click({ force: true });
  await expect(page.getByRole('dialog', { name: 'Delete Lessee Card?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Lessee Card' }).click();

  await expect(page.getByText('Lessor: Charlotte Whitaker')).toBeHidden();
  await expect(page.getByText('Lessor: Olivia Whitaker')).toBeVisible();

  await page.getByRole('button', { name: 'Leasehold' }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: /C1 C1 — Baseline Splits/ }).click();
  await expect(
    page.getByText('C1 — Baseline Splits — Charlotte Whitaker Lease')
  ).toBeHidden();
  await expect(
    page.getByText('C1 — Baseline Splits — Olivia Whitaker Lease')
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('curative issues can be linked, edited, and filtered', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);

  await page.getByRole('button', { name: 'Curative' }).click();
  const curativeShell = page.locator('main').first();
  const curativeDetail = page.locator('main section').first();
  await page.getByRole('button', { name: '+ New Issue' }).click();

  await fillInput(curativeDetail, 'Issue Title', 'Affidavit needed for Raven C2 heirship');
  await selectExact(curativeDetail, 'Issue Type', 'Probate / heirship');
  await selectExact(curativeDetail, 'Priority', 'High');
  await selectExact(curativeDetail, 'Status', 'Ready for Review');
  await fillInput(curativeDetail, 'Source Doc No.', 'C2-AOH-REVIEW');
  await fillTextArea(
    curativeDetail,
    'Required Curative Action',
    'Obtain recorded affidavit of heirship and match it to the C2 branch.'
  );
  await selectFirstLinkedOption(curativeDetail, 'Tract / Desk Map');
  await selectFirstLinkedOption(curativeDetail, 'Branch / Owner Card');
  await selectFirstLinkedOption(curativeDetail, 'Owner Record');
  await selectFirstLinkedOption(curativeDetail, 'Lease Record');
  await page.getByRole('button', { name: 'Save Issue' }).click();

  await fillInput(curativeShell, 'Search', 'C2-AOH-REVIEW');
  await expect(
    page.getByText('Affidavit needed for Raven C2 heirship').first()
  ).toBeVisible();
  await expect(await labeledControl(curativeDetail, 'Status', 'select')).toHaveValue(
    'Ready for Review'
  );

  expect(browserErrors).toEqual([]);
});

test('research records can be created, linked, and searched', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);

  await page.getByRole('button', { name: 'Research', exact: true }).click();
  const researchShell = page.locator('main').first();

  await page.getByRole('button', { name: 'Add Source' }).click();
  await fillInput(researchShell, 'Title', 'Raven C2 deed packet');
  await selectExact(researchShell, 'Source Type', 'Lease Document');
  await selectExact(researchShell, 'Context', 'Texas');
  await selectExact(researchShell, 'Review Status', 'Verified');
  await fillInput(researchShell, 'Citation / Doc Ref', 'RF-C2-SOURCE-PACKET');
  await selectFirstLinkedOption(researchShell, 'Desk Map');
  await selectFirstLinkedOption(researchShell, 'Title / Branch Card');
  await selectFirstLinkedOption(researchShell, 'Owner');
  await selectFirstLinkedOption(researchShell, 'Lease');

  await fillInput(researchShell, 'Search Research', 'RF-C2-SOURCE-PACKET');
  await expect(page.getByText('Raven C2 deed packet').first()).toBeVisible();

  await page.getByRole('button', { name: /Project Records/ }).click();
  await page.getByRole('button', { name: 'Add Project Record' }).click();
  await fillInput(researchShell, 'Name', 'Raven C2 acquisition note');
  await fillInput(researchShell, 'County', 'Walker');
  await fillInput(researchShell, 'Source Packet Status', 'Verified source packet');
  await selectFirstLinkedOption(researchShell, 'Desk Map');
  await selectFirstLinkedOption(researchShell, 'Title / Lease Card');
  await selectFirstLinkedOption(researchShell, 'Owner');
  await selectFirstLinkedOption(researchShell, 'Lease');
  await checkLinkedRecord(researchShell, 'Raven C2 deed packet');

  await fillInput(researchShell, 'Search Research', 'Verified source packet');
  await expect(page.getByText('Raven C2 acquisition note').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('research opens as the source workspace home and keeps imports secondary', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await page.getByRole('button', { name: 'Research', exact: true }).click();

  await expect(page.getByText('Research').first()).toBeVisible();
  await expect(
    page.getByText(
      'Source library, formula cards, federal/private project records, and saved questions.'
    )
  ).toBeVisible();
  const researchSidebar = page.locator('main aside').first();
  await expect(researchSidebar.getByRole('button', { name: /Sources/ })).toBeVisible();
  await expect(researchSidebar.getByRole('button', { name: /Formulas/ })).toBeVisible();
  await expect(
    researchSidebar.getByRole('button', { name: /Project Records/ })
  ).toBeVisible();
  await expect(
    researchSidebar.getByRole('button', { name: /Data Imports/ })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Source' })).toBeVisible();
  await expect(page.getByText('Cross-Library Search', { exact: true })).toBeVisible();
  await expect(page.getByText('Review Queue', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add Starters' }).click();
  await fillInput(page.locator('main').first(), 'Search Research', 'NRI Before ORRI');
  await page.getByText('NRI Before ORRI').first().click();
  await expect(page.getByText('LANDMAN Math Reference').first()).toBeVisible();
  await expect(page.getByText('Data Imports').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('federal leasing tracks leases, targets, expirations, sources, and maps', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);
  const expirationDate = isoDateOffset(45);
  const nextActionDate = isoDateOffset(10);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await page.getByRole('button', { name: 'Research' }).click();
  const researchSidebar = page.locator('main aside').first();
  const researchDetail = page.locator('main section').first();
  await page.getByRole('button', { name: 'Add Source' }).click();
  await fillInput(researchDetail, 'Title', 'BLM case file');
  await selectExact(researchDetail, 'Source Type', 'Lease Document');
  await selectExact(researchDetail, 'Context', 'Federal / BLM');
  await selectExact(researchDetail, 'Review Status', 'Verified');
  await fillInput(researchDetail, 'Citation / Doc Ref', 'BLM NMNM case file packet');

  await page.getByRole('button', { name: 'Maps' }).click();
  await page
    .locator('input[type="file"][accept=".pdf,.png,.jpg,.jpeg,.geojson,.json"]')
    .setInputFiles({
      name: 'north-mesa.geojson',
      mimeType: 'application/geo+json',
      buffer: Buffer.from('{"type":"FeatureCollection","features":[]}'),
    });
  await expect(page.getByText('north-mesa.geojson').first()).toBeVisible();
  await page
    .getByLabel('Map Asset Details')
    .getByRole('button', { name: 'Save' })
    .click();

  await page.getByRole('button', { name: 'Federal Leasing' }).click();
  const federalShell = page.locator('main').first();
  const federalSidebar = federalShell.locator('aside').first();
  const federalDetail = federalShell.locator('section').last();
  await expect(page.getByText('Federal Leasing').first()).toBeVisible();
  await expect(
    page.getByText(
      'Federal Leasing records are reference and tracking records only.'
    )
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add Existing Federal Lease' }).click();
  await fillInput(federalDetail, 'Name', 'North Mesa Federal Lease');
  await fillInput(federalDetail, 'Serial / Reference', 'NMNM 123456');
  await fillInput(federalDetail, 'Legacy Serial', 'NMNM 123456');
  await fillInput(federalDetail, 'MLRS Serial', 'MLRS-987654');
  await fillInput(federalDetail, 'Lessee / Applicant', 'Mesa Acquisition Co.');
  await fillInput(federalDetail, 'Operator', 'Raven Federal Operating');
  await fillInput(federalDetail, 'State', 'NM');
  await fillInput(federalDetail, 'County', 'Eddy');
  await fillInput(federalDetail, 'Prospect Area', 'Delaware North');
  await fillInput(federalDetail, 'Effective Date', isoDateOffset(-365));
  await fillInput(federalDetail, 'Expiration Date', expirationDate);
  await fillInput(federalDetail, 'Primary Term', '10 years');
  await fillInput(federalDetail, 'Next Action Date', nextActionDate);
  await fillInput(federalDetail, 'Priority', 'High');
  await fillInput(federalDetail, 'Source Packet Status', 'Ready for bid review');
  await fillInput(federalDetail, 'Acres', '640');
  await fillTextArea(
    federalDetail,
    'Legal Description / Tract Notes',
    'Section 12, T20S-R30E, federal reference-only lease tracking.'
  );
  await fillTextArea(
    federalDetail,
    'Next Action',
    'Confirm source packet before the next BLM lease sale window.'
  );
  await checkLinkedRecord(federalDetail, 'BLM case file');

  await fillInput(federalSidebar, 'Search Federal Leasing', 'MLRS-987654');
  await expect(page.getByText('North Mesa Federal Lease').first()).toBeVisible();
  await fillInput(federalSidebar, 'Search Federal Leasing', 'BLM case file');
  await expect(page.getByText('North Mesa Federal Lease').first()).toBeVisible();
  await fillInput(federalSidebar, 'Search Federal Leasing', '');
  await expect(page.getByText(`Upcoming ${expirationDate}`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Add Potential Target' }).click();
  await fillInput(federalDetail, 'Name', 'North Mesa Potential Parcel');
  await fillInput(federalDetail, 'MLRS Serial', 'MLRS-TARGET-100');
  await fillInput(federalDetail, 'County', 'Lea');
  await fillInput(federalDetail, 'Prospect Area', 'Delaware North');
  await federalSidebar.getByRole('tab', { name: /Targets/ }).click();
  await expect(page.getByText('North Mesa Potential Parcel').first()).toBeVisible();

  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await fillInput(researchSidebar, 'Search Research', 'MLRS-987654');
  await expect(page.getByText('North Mesa Federal Lease').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});
