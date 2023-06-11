// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { expect, galata, test } from '@jupyterlab/galata';
import * as path from 'path';

const fileName = 'simple_notebook.ipynb';

test.use({ tmpPath: 'notebook-run-test' });

test.describe.serial('Notebook Run', () => {
  test.beforeAll(async ({ request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.uploadFile(
      path.resolve(__dirname, `./notebooks/${fileName}`),
      `${tmpPath}/${fileName}`
    );
    await contents.uploadFile(
      path.resolve(__dirname, './notebooks/WidgetArch.png'),
      `${tmpPath}/WidgetArch.png`
    );
  });

  test.beforeEach(async ({ page, tmpPath }) => {
    await page.filebrowser.openDirectory(tmpPath);
  });

  test.afterAll(async ({ request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.deleteDirectory(tmpPath);
  });

  test('Run Notebook and capture cell outputs', async ({ page, tmpPath }) => {
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);

    let numNBImages = 0;

    const getCaptureImageName = (id: number): string => {
      return `notebook-panel-${id}.png`;
    };
    const captures = new Array<Buffer>();

    await page.notebook.runCellByCell({
      onBeforeScroll: async () => {
        const nbPanel = await page.notebook.getNotebookInPanel();
        if (nbPanel) {
          captures.push(await nbPanel.screenshot());
          numNBImages++;
        }
      }
    });

    // Save outputs for the next tests
    await page.notebook.save();

    const nbPanel = await page.notebook.getNotebookInPanel();
    captures.push(await nbPanel.screenshot());
    numNBImages++;

    for (let c = 0; c < numNBImages; ++c) {
      expect.soft(captures[c]).toMatchSnapshot(getCaptureImageName(c));
    }
  });

  test('Check cell output 1', async ({ page, tmpPath }) => {
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    const cellOutput = await page.notebook.getCellTextOutput(5);
    expect(parseInt(cellOutput[0])).toBe(4);
  });

  test('Check cell output 2', async ({ page, tmpPath }) => {
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    const cellOutput = await page.notebook.getCellTextOutput(6);
    expect(parseFloat(cellOutput[0])).toBeGreaterThan(1.5);
  });

  test('Close Notebook', async ({ page, tmpPath }) => {
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await expect(page.notebook.close(true)).resolves.not.toThrow();
  });

  test('Restart kernel and execute cells', async ({ page, tmpPath }) => {
    test.setTimeout(60000 * 100);
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);

    const acceptDialog = async () => {
      const dialogSelector = '.jp-Dialog-content';
      await page.waitForSelector(dialogSelector);
      // Accept option to trust the notebook
      await page.click('.jp-Dialog-button.jp-mod-accept');
    };

    const nbPanel = await page.notebook.getNotebookInPanel();
    const firstCell = await page.notebook.getCell(0);
    await page.addStyleTag({ content: '.jp-cell-toolbar{display: none}' });

    for (let repeat = 0; repeat < 100; repeat++) {
      // 1. Restart and run all using a single command
      await page.menu.clickMenuItem('Kernel>Restart Kernel and Run All Cells…');
      await acceptDialog();
      await page.notebook.waitForRun();
      // Click on first cell to avoid random hover effects due to mouse movement
      await firstCell.click();
      expect(await nbPanel.screenshot()).toMatchSnapshot('restart-and-run.png');

      // 2. Restart manually and run all cells at once
      await page.menu.clickMenuItem('Kernel>Restart Kernel…');
      await acceptDialog();
      await page.notebook.run();
      await firstCell.click();
      expect(await nbPanel.screenshot()).toMatchSnapshot('restart-and-run.png');

      // 3. Restart manually and run cell-by-cell
      await page.menu.clickMenuItem('Kernel>Restart Kernel…');
      await acceptDialog();
      await page.notebook.runCellByCell();
      await firstCell.click();
      expect(await nbPanel.screenshot()).toMatchSnapshot('restart-and-run.png');

      // 4. Restart manually and run with keyboard
      await page.menu.clickMenuItem('Kernel>Restart Kernel…');
      await acceptDialog();
      for (let i = 0; i < 6; i++) {
        await nbPanel.press('Shift+Enter');
      }
      await nbPanel.press('Control+Enter');
      await nbPanel.waitForSelector('.jp-InputArea-prompt >> text=[4]');
      await firstCell.click();
      expect(await nbPanel.screenshot()).toMatchSnapshot('restart-and-run.png');
    }
  });
});
