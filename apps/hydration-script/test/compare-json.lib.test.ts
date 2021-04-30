/**
=========================================================================
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

import "jest";

declare const describe: jest.Describe;
declare const test: jest.It;
declare const expect: jest.Expect;

import { CompareJson } from "../src/lib/compare-json.lib";

const compareJson = new CompareJson({});

describe("compare-json", () => {
  test("Non-existent files", async () => {
    await expect(
      compareJson.compare("test/data/.percyrc", "wrong-file-name.json")
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        "ENOENT: no such file or directory, open"
      )
    });
    await expect(
      compareJson.compare("wrong-file-name.json", "test/data/.percyrc")
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        "ENOENT: no such file or directory, open"
      )
    });
  });

  test("Same files", async () => {
    await expect(
      compareJson.compare("test/data/.percyrc", "test/data/.percyrc")
    ).resolves.toBeUndefined();
  });

  test("Different files", async () => {
    await expect(
      compareJson.compare("test/data/.percyrc", "test/data/modified.percyrc")
    ).resolves.toEqual({
      newField: [{ field: 0 }],
      variableNamePrefix: ["_", "?"],
      variableSuffix: ["}", 0, 0]
    });
  });
});
