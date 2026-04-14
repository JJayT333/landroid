import { expect, type Page, test } from '@playwright/test';

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
