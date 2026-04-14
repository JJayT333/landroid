import { expect, type Locator, type Page, test } from '@playwright/test';

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

async function loadLeaseholdDemo(page: Page) {
  await page.getByRole('button', { name: 'Leasehold (8 Tracts)' }).click();
  await expect(page.getByText('Leasehold Demo — 8 Tracts')).toBeVisible({
    timeout: 30_000,
  });
}

async function replaceFirstVisibleLeasePdf(page: Page, fileName: string) {
  await page.getByText('Permian Basin Operating, LLC').first().click();
  await expect(page.getByText('Lease PDF')).toBeVisible();
  await page.locator('input[type="file"][accept=".pdf"]').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n% LANDroid ${fileName}\n%%EOF`),
  });
  await expect(page.getByText(fileName)).toBeVisible();
  await page.getByRole('button', { name: 'Save Lessee Node' }).click();
  await expect(
    page.locator(`[title="View attached PDF: ${fileName}"]`)
  ).toBeVisible();
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

async function selectContaining(
  root: Locator,
  label: string,
  optionText: string
) {
  const select = await labeledControl(root, label, 'select');
  const option = select.locator('option').filter({ hasText: optionText }).first();
  const value = await option.getAttribute('value');

  expect(value, `option containing "${optionText}" for ${label}`).not.toBeNull();
  await select.selectOption(value ?? '');
}

async function checkLinkedRecord(root: Locator, recordText: string) {
  await root
    .locator('label')
    .filter({ hasText: recordText })
    .locator('input[type="checkbox"]')
    .check();
}

test('leasehold seed keeps PDF filenames visible and owner leases branch-aware', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadLeaseholdDemo(page);
  await expect(
    page.locator('[title="View attached PDF: T1-patent.pdf"]')
  ).toBeVisible();
  await expect(
    page.locator('[title="View attached PDF: T1-lease.pdf"]')
  ).toBeVisible();
  await expect(
    page.getByText('Raven Bend Minerals, LLC', { exact: true }).first()
  ).toBeVisible();

  await replaceFirstVisibleLeasePdf(page, 'replacement-lease.pdf');

  await page.getByText('Tract 4', { exact: true }).click();
  await expect(
    page.locator('[title="View attached PDF: T4-patent.pdf"]')
  ).toBeVisible();
  await expect(
    page.locator('[title="View attached PDF: T4-lease.pdf"]')
  ).toBeVisible();
  await expect(
    page.getByText('Raven Bend Minerals, LLC', { exact: true }).first()
  ).toBeVisible();

  await page.getByRole('button', { name: 'Owners' }).click();
  await page
    .getByPlaceholder('Owner, county, prospect, lease...')
    .fill('Raven Bend Minerals');
  await expect(page.getByText(/Showing 1\/\d+/)).toBeVisible();
  await expect(
    page.getByText('Raven Bend Minerals, LLC', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText('2 lease records • 2 active')).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('landroid export/import preserves lease PDFs and same-owner records', async ({
  page,
}, testInfo) => {
  const browserErrors = collectBrowserErrors(page);
  const roundTripPath = testInfo.outputPath('leasehold-roundtrip.landroid');

  await openApp(page);
  await loadLeaseholdDemo(page);
  await replaceFirstVisibleLeasePdf(page, 'roundtrip-lease.pdf');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const download = await downloadPromise;
  await download.saveAs(roundTripPath);

  await page.getByRole('button', { name: 'Stress (100/150/500)' }).click();
  await expect(page.getByText('Stress Test — 3 Tracts')).toBeVisible({
    timeout: 45_000,
  });

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(roundTripPath);

  await expect(page.getByText('Leasehold Demo — 8 Tracts')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.locator('[title="View attached PDF: T1-patent.pdf"]')
  ).toBeVisible();
  await expect(
    page.locator('[title="View attached PDF: roundtrip-lease.pdf"]')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Owners' }).click();
  await page
    .getByPlaceholder('Owner, county, prospect, lease...')
    .fill('Raven Bend Minerals');
  await expect(page.getByText(/Showing 1\/\d+/)).toBeVisible();
  await expect(page.getByText('2 lease records • 2 active')).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('deleting a branch-scoped lessee card removes only that owner lease', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadLeaseholdDemo(page);

  await page
    .getByText('Lease: Tract 1 — Raven Bend Minerals, LLC Lease', { exact: true })
    .hover();
  let deleteDialogMessage = '';
  page.once('dialog', async (dialog) => {
    deleteDialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'DELETE' }).click();
  expect(deleteDialogMessage).toContain(
    'remove the linked lease from the owner record'
  );

  await expect(
    page.getByText('Lease: Tract 1 — Raven Bend Minerals, LLC Lease', {
      exact: true,
    })
  ).toHaveCount(0);

  await page.getByText('Tract 4', { exact: true }).click();
  await expect(
    page.getByText('Lease: Tract 4 — Raven Bend Minerals, LLC Lease', {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.locator('[title="View attached PDF: T4-lease.pdf"]')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Owners' }).click();
  await page
    .getByPlaceholder('Owner, county, prospect, lease...')
    .fill('Raven Bend Minerals');
  await expect(page.getByText(/Showing 1\/\d+/)).toBeVisible();
  await expect(page.getByText('1 lease record • 1 active')).toBeVisible();
  await expect(page.getByText('2 lease records • 2 active')).toHaveCount(0);

  expect(browserErrors).toEqual([]);
});

test('curative issues can be linked, edited, and filtered', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  const curativePanel = page
    .getByRole('button', { name: 'Save Issue' })
    .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  const curativeSidebar = page.locator('main aside').first();

  await openApp(page);
  await loadLeaseholdDemo(page);
  await page.getByRole('button', { name: 'Curative' }).click();
  await expect(page.getByText('No curative issues yet.')).toBeVisible();

  await page.getByRole('button', { name: '+ New Issue' }).click();
  await fillInput(curativePanel, 'Issue Title', 'Raven Bend ratification follow-up');
  await selectExact(curativePanel, 'Issue Type', 'Missing ratification');
  await selectExact(curativePanel, 'Priority', 'High');
  await selectExact(curativePanel, 'Status', 'Curative Requested');
  await fillInput(curativePanel, 'Source Doc No.', 'LHD-20007');
  await fillInput(curativePanel, 'Due Date', '2026-05-15');
  await fillInput(curativePanel, 'Responsible Party', 'Abstract Mapping');
  await fillTextArea(
    curativePanel,
    'Required Curative Action',
    'Obtain ratification packet and confirm pooling authority before payout.'
  );
  await fillTextArea(
    curativePanel,
    'Working Notes',
    'Raven Bend has branch-scoped leases in more than one tract; review each separately.'
  );
  await selectContaining(curativePanel, 'Tract / Desk Map', 'Tract 1');
  await selectContaining(curativePanel, 'Branch / Owner Card', 'Raven Bend Minerals');
  await selectContaining(curativePanel, 'Owner Record', 'Raven Bend Minerals');
  await selectContaining(curativePanel, 'Lease Record', 'Tract 1');
  await page.getByRole('button', { name: 'Save Issue' }).click();

  await expect(
    page.getByText('Raven Bend ratification follow-up').first()
  ).toBeVisible();
  await expect(curativePanel.getByText('Raven Bend Minerals, LLC').first()).toBeVisible();
  await expect(curativePanel.getByText(/Tract 1/).first()).toBeVisible();

  await page
    .getByPlaceholder('Owner, tract, defect, doc no., cure...')
    .fill('ratification packet');
  await expect(page.getByText('Showing 1/1')).toBeVisible();

  await page
    .getByPlaceholder('Owner, tract, defect, doc no., cure...')
    .fill('no such curative');
  await expect(page.getByText('No issues match.')).toBeVisible();

  await page
    .getByPlaceholder('Owner, tract, defect, doc no., cure...')
    .fill('Raven Bend');
  await expect(
    page.getByText('Raven Bend ratification follow-up').first()
  ).toBeVisible();
  await selectExact(curativePanel, 'Status', 'Ready for Review');
  await fillTextArea(
    curativePanel,
    'Resolution Notes',
    'Ratification packet received and ready for title-opinion review.'
  );
  await page.getByRole('button', { name: 'Save Issue' }).click();
  await selectExact(curativeSidebar, 'Status', 'Ready for Review');
  await expect(page.getByText('Showing 1/1')).toBeVisible();

  await page.getByRole('button', { name: 'Open Desk Map' }).click();
  await expect(page.getByText('Leasehold Demo — 8 Tracts')).toBeVisible();
  await expect(
    page.getByText('Raven Bend Minerals, LLC', { exact: true }).first()
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('research records can be created, linked, and searched', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  const researchShell = page.locator('main').first();
  const researchSidebar = page.locator('main aside').first();
  const researchDetail = page.locator('main').first();

  await openApp(page);
  await loadLeaseholdDemo(page);
  await page.getByRole('button', { name: 'Research' }).click();

  await page.getByRole('button', { name: 'Add Source' }).click();
  await fillInput(researchDetail, 'Title', 'Texas royalty payment statute');
  await selectExact(researchDetail, 'Source Type', 'Statute');
  await selectExact(researchDetail, 'Context', 'Texas');
  await fillInput(researchDetail, 'Citation / Doc Ref', 'Tex. Nat. Res. Code §91.402');
  await fillInput(
    researchDetail,
    'URL',
    'https://statutes.capitol.texas.gov/GetStatute.aspx?Code=NR&Value=91.402'
  );
  await fillTextArea(
    researchDetail,
    'Notes',
    'Source record supports royalty-payment review and formula citations.'
  );
  await selectContaining(researchDetail, 'Desk Map', 'Tract 1');
  await selectContaining(researchDetail, 'Title / Branch Card', 'Raven Bend Minerals');
  await selectContaining(researchDetail, 'Owner', 'Raven Bend Minerals');
  await selectContaining(researchDetail, 'Lease', 'Tract 1');
  await fillInput(researchSidebar, 'Search Research', '91.402');
  await expect(page.getByText('Texas royalty payment statute').first()).toBeVisible();
  await fillInput(researchSidebar, 'Search Research', '');

  await page.getByRole('button', { name: /^Formulas/ }).click();
  await page.getByRole('button', { name: 'Add Formula' }).click();
  await fillInput(researchDetail, 'Title', 'Branch lease royalty check');
  await selectExact(researchDetail, 'Category', 'Leasehold');
  await selectExact(researchDetail, 'Status', 'Verified');
  await fillInput(
    researchDetail,
    'Engine Reference',
    'src/components/leasehold/leasehold-summary.ts'
  );
  await fillTextArea(
    researchDetail,
    'Formula',
    'leased branch fraction x lease royalty'
  );
  await fillTextArea(
    researchDetail,
    'Plain-English Explanation',
    'Confirms the branch lease royalty slice before transfer-order review.'
  );
  await fillTextArea(
    researchDetail,
    'Variables',
    'leased branch fraction; lease royalty; active lease status'
  );
  await fillTextArea(
    researchDetail,
    'Example',
    '1/2 branch leased at 1/8 royalty produces a 1/16 royalty slice.'
  );
  await checkLinkedRecord(researchDetail, 'Texas royalty payment statute');
  await fillInput(researchSidebar, 'Search Research', 'leased branch fraction');
  await expect(page.getByText('Branch lease royalty check').first()).toBeVisible();
  await fillInput(researchSidebar, 'Search Research', '');

  await page.getByRole('button', { name: /^Project Records/ }).click();
  await page.getByRole('button', { name: 'Add Project Record' }).click();
  await fillInput(researchDetail, 'Name', 'NM Federal Lease NMNM 123456');
  await fillInput(researchDetail, 'Serial / Reference', 'NMNM 123456');
  await selectExact(researchDetail, 'Record Type', 'Federal Lease');
  await selectExact(researchDetail, 'Jurisdiction', 'Federal / BLM');
  await selectExact(researchDetail, 'Status', 'Target');
  await fillInput(researchDetail, 'Acquisition Status', 'Source review complete');
  await fillInput(researchDetail, 'Acres', '640');
  await fillTextArea(
    researchDetail,
    'Legal Description / Tract Notes',
    'Section 12, T20S-R30E reference-only federal/private project tracking.'
  );
  await checkLinkedRecord(researchDetail, 'Texas royalty payment statute');
  await fillTextArea(
    researchDetail,
    'Notes',
    'Reference-only lease package; no federal math should run in this phase.'
  );
  await expect(
    page.getByText(
      'Federal/private project records are information tracking only in this phase.'
    )
  ).toBeVisible();
  await fillInput(researchSidebar, 'Search Research', 'NMNM 123456');
  await expect(page.getByText('NM Federal Lease NMNM 123456').first()).toBeVisible();

  await page.getByRole('button', { name: 'Desk Map' }).click();
  await expect(page.getByText('Fully leased')).toBeVisible();
  await page.getByRole('button', { name: 'Research' }).click();
  await fillInput(researchSidebar, 'Search Research', '');

  await page.getByRole('button', { name: /^Questions/ }).click();
  await page.getByRole('button', { name: 'Add Question' }).click();
  await fillTextArea(
    researchDetail,
    'Question',
    'What source supports the branch lease royalty formula?'
  );
  await selectExact(researchDetail, 'Status', 'Answered');
  await fillTextArea(
    researchDetail,
    'Answer / Working Notes',
    'Use the verified formula card and cited Texas royalty-payment source.'
  );
  await checkLinkedRecord(researchDetail, 'Texas royalty payment statute');
  await checkLinkedRecord(researchDetail, 'Branch lease royalty check');
  await checkLinkedRecord(researchDetail, 'NM Federal Lease NMNM 123456');
  await fillTextArea(
    researchDetail,
    'Notes',
    'Manual saved answer now; ready for later AI grounding.'
  );
  await fillInput(researchSidebar, 'Search Research', 'royalty formula');
  await expect(
    page.getByText('What source supports the branch lease royalty formula?').first()
  ).toBeVisible();
  await fillInput(researchSidebar, 'Search Research', 'no matching research record');
  await expect(page.getByText('No saved questions yet.')).toBeVisible();

  await expect(researchShell.getByRole('button', { name: /^Data Imports/ })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('research opens as the source workspace and keeps imports secondary', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadLeaseholdDemo(page);

  await page.getByRole('button', { name: 'Research' }).click();

  await expect(page.getByText('Research').first()).toBeVisible();
  await expect(
    page.getByText(
      'Source library, formula cards, federal/private project records, and saved questions.'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Sources/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Formulas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Project Records/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Data Imports/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Source' })).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test('stress seed loads current desk-map cards with document badges', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await page.getByRole('button', { name: 'Stress (100/150/500)' }).click();

  await expect(page.getByText('Stress Test — 3 Tracts')).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/^\d+ cards$/).first()).toBeVisible();
  await expect(page.locator('[title^="View attached PDF:"]').first()).toBeVisible();
  await expect(page.getByText('Present Owner').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});
