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

/**
 * Load the combinatorial demo through the Navbar's Demo Data dropdown.
 * The leasehold and stress demos were retired in Phase 3 — only the
 * combinatorial fixture remains, and all deep leasehold-specific
 * assertions below are skipped until Phase 4 rebuilds them against the
 * new 10-tract Raven Forest fixture.
 */
async function loadCombinatorialDemo(page: Page) {
  await page.getByRole('button', { name: /Demo Data/ }).click();
  await page
    .getByRole('menuitem', { name: /Combinatorial/ })
    .click();
  await expect(page.getByText(/Combinatorial Demo — /)).toBeVisible({
    timeout: 45_000,
  });
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

test('combinatorial demo loads with desk-map cards and PDF badges', async ({
  page,
}) => {
  const browserErrors = collectBrowserErrors(page);

  await openApp(page);
  await loadCombinatorialDemo(page);

  await expect(page.getByText(/Combinatorial Demo — /)).toBeVisible();
  await expect(page.getByText(/^\d+ cards$/).first()).toBeVisible();
  await expect(page.locator('[title^="View attached PDF:"]').first()).toBeVisible();
  // Present-owner status now shows as a sky card tint + retained-interest gold
  // dot instead of a "Present Owner" pill — assert at least one retained-interest
  // marker rendered on a combinatorial desk-map card.
  await expect(page.locator('[title^="Present owner"]').first()).toBeVisible();

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

test.skip('leasehold seed keeps PDF filenames visible and owner leases branch-aware', async ({
  page,
}) => {
  // PHASE 3: the 8-tract leasehold demo was retired along with the stress
  // fixture. Phase 4 rebuilds the same assertions against the new 10-tract
  // Raven Forest combinatorial fixture (unit grouping + same-owner lease
  // coverage). Until then this test is skipped.
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);
  expect(browserErrors).toEqual([]);
});

test.skip('landroid export/import preserves lease PDFs and same-owner records', async ({
  page,
}) => {
  // PHASE 3: depends on the retired leasehold fixture. Phase 4 will retarget
  // this round-trip against the combinatorial Raven Forest unit seed.
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);
  expect(browserErrors).toEqual([]);
});

test.skip('deleting a branch-scoped lessee card removes only that owner lease', async ({
  page,
}) => {
  // PHASE 3: depends on 'Raven Bend Minerals' same-owner multi-tract branch
  // leases from the retired leasehold demo. Phase 4 will rebuild equivalent
  // owner-branching coverage in the combinatorial fixture.
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);
  expect(browserErrors).toEqual([]);
});

test.skip('curative issues can be linked, edited, and filtered', async ({ page }) => {
  // PHASE 3: curative linkage test asserts leasehold-specific tract/owner/lease
  // selections that no longer exist. Phase 4 will rebuild curative linkage
  // coverage against the combinatorial fixture's stable owner cards.
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);
  expect(browserErrors).toEqual([]);
});

test.skip('research records can be created, linked, and searched', async ({ page }) => {
  // PHASE 3: research linkage test references leasehold-specific owner/lease
  // labels. Phase 4 will retarget linkage to combinatorial cards.
  const browserErrors = collectBrowserErrors(page);
  await openApp(page);
  await loadCombinatorialDemo(page);
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
  await federalSidebar.getByRole('button', { name: /Targets/ }).click();
  await expect(page.getByText('North Mesa Potential Parcel').first()).toBeVisible();

  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await fillInput(researchSidebar, 'Search Research', 'MLRS-987654');
  await expect(page.getByText('North Mesa Federal Lease').first()).toBeVisible();

  expect(browserErrors).toEqual([]);
});
