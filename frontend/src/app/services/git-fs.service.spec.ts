import { percyConfig } from 'config';
import { git, FSExtra, getBrowserFS } from './git-fs.service';

describe('git-fs.service', () => {

  let fs: FSExtra;
  beforeAll(async() => {
    fs = await getBrowserFS();
  });

  it('should initialize git and browser fs', async () => {

    expect(git.version()).toBeDefined();

    expect(await fs.exists(percyConfig.reposFolder)).toBeTruthy();

    expect(await fs.exists(percyConfig.metaFolder)).toBeTruthy();

    expect(await fs.exists(percyConfig.draftFolder)).toBeTruthy();

    // Now read/write some file to test
    const file = '/temp/temp2/test.txt';
    try {
      await fs.remove('/temp');
      await fs.mkdirs('/temp/temp2');
  
      await fs.writeFile(file, 'hello test');
  
      expect(await fs.exists(file)).toBeTruthy();
  
      expect((await fs.readFile(file)).toString()).toEqual('hello test');
  
      await fs.appendFile(file, ' appended');
  
      expect((await fs.readFile(file)).toString()).toEqual('hello test appended');
  
      expect(await fs.readdir('/temp/temp2')).toEqual(['test.txt']);
  
      expect((await fs.stat(file)).size).toBeGreaterThan(0);
  
      const newFile = '/temp/temp2/new.txt';
      await fs.rename(file, newFile);
  
      expect(await fs.exists(newFile)).toBeTruthy();
  
      await fs.unlink(newFile);
  
      expect(await fs.exists(newFile)).toBeFalsy();
    } finally {
      await fs.remove('/temp');
    }
  });
});
