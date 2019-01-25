import {CompareJson} from "../src/lib/compare-json.lib";

const compareJson = new CompareJson({});

describe("compare-json", () => {

    test("Non-existent files", async () => {
        await expect(compareJson.compare("test/data/.percyrc", "wrong-file-name.json"))
            .rejects.toMatchObject({message: expect.stringContaining("ENOENT: no such file or directory, open")});
        await expect(compareJson.compare("wrong-file-name.json", "test/data/.percyrc" ))
            .rejects.toMatchObject({message: expect.stringContaining("ENOENT: no such file or directory, open")});
    });

    test("Same files", async () => {
        await expect(compareJson.compare("test/data/.percyrc", "test/data/.percyrc")).resolves.toBeUndefined();
    });

    test("Different files", async () => {
        await expect(compareJson.compare("test/data/.percyrc", "test/data/modified.percyrc"))
            .resolves.toEqual({
                newField: [{field: 0}],
                variableNamePrefix: ["_", "?"],
                variableSuffix: ["}", 0, 0],
            });
    });
});
