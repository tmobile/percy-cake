import { utilService } from '../test/test-helper';

import { FS } from '../services/util.service';

import { MemoryPool } from './storage';

describe('File System', () => {

  // The count of concurrency for stress test
  const count = 50;

  let fs: FS;

  beforeEach(async () => {
    fs = await utilService.getBrowserFS();
    await fs.remove('/temp');
  });

  afterAll(async () => {
    await fs.remove('/temp');
  });

  it('read/write/append file should be successful', async () => {

    const file = '/temp/temp2/test.txt';
    await fs.mkdirs('/temp/temp2');

    await fs.writeFile(file, 'hello test');

    expect(await fs.pathExists(file)).toBeTruthy();

    expect((await fs.readFile(file)).toString()).toEqual('hello test');

    await fs.appendFile(file, ' appended');

    expect((await fs.readFile(file)).toString()).toEqual('hello test appended');

    expect(await fs.readdir('/temp/temp2')).toEqual(['test.txt']);

    expect((await fs.stat(file)).size).toBeGreaterThan(0);

    const json = { key1: 123, key2: true, key3: ['value1', 'value2'] };
    await fs.outputJson(file, json);
    expect(await fs.readJson(file)).toEqual(json);

    const newFile = '/temp/temp2/new.txt';
    await fs.rename(file, newFile);

    expect(await fs.pathExists(newFile)).toBeTruthy();

    await fs.unlink(newFile);

    expect(await fs.pathExists(newFile)).toBeFalsy();
  });

  it('concurrently read/write/delete should be successful', async () => {

    const folder = '/temp/repo/apps/app1';
    await fs.ensureDir(folder);

    const files = [];
    for (let i = 0; i < count; i++) {
      files.push(i + '.txt');
    }

    await Promise.all(files.map(async (file, idx) => {
      const filepath = folder + '/' + file;
      await fs.writeFile(filepath, 'test' + idx);
      expect(await fs.pathExists(filepath)).toBeTruthy();
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual('test' + idx);
    }));

    expect((await fs.readdir(folder)).sort()).toEqual(files.sort());

    for (let i = 0; i < count; i++) {
      const filepath = folder + '/' + i + '.txt';
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual('test' + i);
    }

    await Promise.all(files.map(async (file) => {
      const filepath = folder + '/' + file;
      expect(await fs.pathExists(filepath)).toBeTruthy();
      const content = await fs.readFile(filepath);
      expect(content.toString().replace('test', '')).toEqual(file.replace('.txt', ''));
      await fs.remove(filepath);
    }));

    expect((await fs.readdir(folder)).length).toEqual(0);

  });

  it('concurrently mkdir should be successful', async () => {

    await fs.ensureDir('/temp/repo/.git');

    const concurrency = [];
    for (let i = 0; i < count; i++) {
      concurrency.push(i);
    }

    const folder = '/temp/repo/apps/app1';
    await Promise.all(concurrency.map(async (idx) => {
      await fs.ensureDir(folder);
      const filepath = folder + '/' + idx + '.txt';
      await fs.writeFile(filepath, 'test' + idx);
      expect(await fs.pathExists(filepath)).toBeTruthy();
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual('test' + idx);
    }));
  });

  it('clear memory cache to simulate page refresh, data should be persistent', async () => {

    const folder = '/temp/repo/apps/app1';
    await fs.ensureDir(folder);

    const files = [];
    for (let i = 0; i < count; i++) {
      files.push(i + '.txt');
    }

    await Promise.all(files.map(async (file, idx) => {
      const filepath = folder + '/' + file;
      await fs.writeFile(filepath, 'test' + idx);
      expect(await fs.pathExists(filepath)).toBeTruthy();
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual('test' + idx);
    }));

    // Now clear memory cache
    Object.keys(MemoryPool).forEach(key => {
      MemoryPool[key].clear();
    });

    expect((await fs.readdir(folder)).sort()).toEqual(files.sort());

    for (let i = 0; i < count; i++) {
      const filepath = folder + '/' + i + '.txt';
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual('test' + i);
    }
  });

});
