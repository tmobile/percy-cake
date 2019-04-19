/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { utilService } from "../test/test-helper";

import { FS } from "../services/util.service";

import { MemoryPool } from "./storage";

describe("File System", () => {
  // The count of concurrency for stress test
  const count = 10;

  let fs: FS;

  beforeEach(async () => {
    fs = await utilService.getBrowserFS();
    await fs.remove("/temp");
  });

  afterAll(async () => {
    await fs.remove("/temp");
  });

  it("read/write/append file should be successful", async () => {
    const file = "/temp/temp2/test.txt";
    await fs.mkdirs("/temp/temp2");

    await fs.writeFile(file, "hello test");

    expect(await fs.pathExists(file)).toBeTruthy();

    expect((await fs.readFile(file)).toString()).toEqual("hello test");

    await fs.appendFile(file, " appended");

    expect((await fs.readFile(file)).toString()).toEqual("hello test appended");

    expect(await fs.readdir("/temp/temp2")).toEqual(["test.txt"]);

    expect((await fs.stat(file)).size).toBeGreaterThan(0);

    const json = { key1: 123, key2: true, key3: ["value1", "value2"] };
    await fs.outputJson(file, json);
    expect(await fs.readJson(file)).toEqual(json);

    const newFile = "/temp/temp2/new.txt";
    await fs.rename(file, newFile);

    expect(await fs.pathExists(newFile)).toBeTruthy();

    await fs.unlink(newFile);

    expect(await fs.pathExists(newFile)).toBeFalsy();
  });

  it("concurrently read/write/delete should be successful", async () => {
    const folder = "/temp/repo/apps/app1";
    await fs.ensureDir(folder);

    const files = [];
    for (let i = 0; i < count; i++) {
      files.push(i + ".txt");
    }

    await Promise.all(
      files.map(async (file, idx) => {
        const filepath = folder + "/" + file;
        await fs.writeFile(filepath, "test" + idx);
        expect(await fs.pathExists(filepath)).toBeTruthy();
        const content = await fs.readFile(filepath);
        expect(content.toString()).toEqual("test" + idx);
      })
    );

    expect((await fs.readdir(folder)).sort()).toEqual(files.sort());

    for (let i = 0; i < count; i++) {
      const filepath = folder + "/" + i + ".txt";
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual("test" + i);
    }

    await Promise.all(
      files.map(async file => {
        const filepath = folder + "/" + file;
        expect(await fs.pathExists(filepath)).toBeTruthy();
        const content = await fs.readFile(filepath);
        expect(content.toString().replace("test", "")).toEqual(
          file.replace(".txt", "")
        );
        await fs.remove(filepath);
      })
    );

    expect((await fs.readdir(folder)).length).toEqual(0);
  });

  it("concurrently mkdir to create a same new folder should be successful", async () => {
    await fs.ensureDir("/temp/repo/.git");

    const concurrency = [];
    for (let i = 0; i < count; i++) {
      concurrency.push(i);
    }

    const folder = "/temp/repo/apps/app1";
    await Promise.all(
      concurrency.map(async idx => {
        await fs.ensureDir(folder);
        const filepath = folder + "/" + idx + ".txt";
        await fs.writeFile(filepath, "test" + idx);
        expect(await fs.pathExists(filepath)).toBeTruthy();
        const content = await fs.readFile(filepath);
        expect(content.toString()).toEqual("test" + idx);
      })
    );

    expect((await fs.readdir(folder)).length).toEqual(count);
  });

  it("concurrently mkdir to create multiple new folders should be successful", async () => {
    await fs.ensureDir("/temp/repo/.git");

    const concurrency = [];
    for (let i = 0; i < count; i++) {
      concurrency.push(i);
    }

    const folder1 = "/temp/repo/apps/app1";
    const folder2 = "/temp/repo/apps/app2";
    const folder3 = "/temp/repo/apps/app3";
    const folder4 = "/temp/repo/apps/app4";
    const folder5 = "/temp/repo/apps/app5";
    const newFolders = [folder1, folder2, folder3, folder4, folder5];
    await Promise.all(
      concurrency.map(async idx => {
        const folder = newFolders[idx % newFolders.length];
        await fs.ensureDir(folder);
        const filepath = folder + "/" + idx + ".txt";
        await fs.writeFile(filepath, "test" + idx);
        expect(await fs.pathExists(filepath)).toBeTruthy();
        const content = await fs.readFile(filepath);
        expect(content.toString()).toEqual("test" + idx);
      })
    );

    for (const folder of newFolders) {
      expect((await fs.readdir(folder)).length).toEqual(
        count / newFolders.length
      );
    }
  });

  it("clear memory cache to simulate page refresh, data should be persistent", async () => {
    const folder = "/temp/repo/apps/app1";
    await fs.ensureDir(folder);

    const files = [];
    for (let i = 0; i < count; i++) {
      files.push(i + ".txt");
    }

    await Promise.all(
      files.map(async (file, idx) => {
        const filepath = folder + "/" + file;
        await fs.writeFile(filepath, "test" + idx);
        expect(await fs.pathExists(filepath)).toBeTruthy();
        const content = await fs.readFile(filepath);
        expect(content.toString()).toEqual("test" + idx);
      })
    );

    // Now clear memory cache
    Object.keys(MemoryPool).forEach(key => {
      MemoryPool[key].clear();
    });

    expect((await fs.readdir(folder)).sort()).toEqual(files.sort());

    for (let i = 0; i < count; i++) {
      const filepath = folder + "/" + i + ".txt";
      const content = await fs.readFile(filepath);
      expect(content.toString()).toEqual("test" + i);
    }
  });
});
