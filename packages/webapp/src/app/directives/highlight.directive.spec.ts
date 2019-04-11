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

import { Component, Input } from "@angular/core";
import { By } from "@angular/platform-browser";
import * as cheerio from "cheerio";

import { Setup, TestContext, utilService } from "test/test-helper";
import { percyConfig } from "config";

const constructVar = utilService.constructVariable;

@Component({
  template: `
    <pre><code appHighlight [highlight]="previewCode" [languages]="['yaml']"></code></pre>
  `
})
class TestHighlightComponent {
  @Input()
  previewCode: string;
}

describe("HighlightDirective", () => {
  const setup = Setup(TestHighlightComponent);

  let ctx: TestContext<TestHighlightComponent>;

  beforeEach(() => {
    ctx = setup();
  });

  it("Should highlight correcly", async () => {
    ctx.component.previewCode = `
default: !!map
  name: !!str "TestUser"
  host: !!str "${constructVar("name")}/${constructVar("age")}/${constructVar(
      "flag"
    )}/_{host1}"
  host1: !!str "${constructVar("host")}" #${constructVar("host")}
  host2: !!str "${constructVar("name")}/${constructVar("age")}"
  api.port: !!int 8080
`;

    ctx.detectChanges();
    await ctx.fixture.whenStable();

    const codeEle = ctx.fixture.debugElement.query(By.css("code"));

    const $ = cheerio.load(codeEle.properties.innerHTML);
    const spans = $("span.hljs-string");

    // check "TestUser"
    expect(spans.eq(0).text()).toEqual('"TestUser"');

    // Check "${name}$/${age}$/${flag}$/_{host1}"
    expect(spans.eq(1).children().length).toEqual(7);
    expect(
      spans
        .eq(1)
        .children()
        .eq(0)
        .text()
    ).toEqual('"' + percyConfig.variablePrefix);
    expect(
      spans
        .eq(1)
        .children()
        .eq(1)
        .text()
    ).toEqual("name");
    expect(
      spans
        .eq(1)
        .children()
        .eq(2)
        .text()
    ).toEqual(percyConfig.variableSuffix + "/" + percyConfig.variablePrefix);
    expect(
      spans
        .eq(1)
        .children()
        .eq(3)
        .text()
    ).toEqual("age");
    expect(
      spans
        .eq(1)
        .children()
        .eq(4)
        .text()
    ).toEqual(percyConfig.variableSuffix + "/" + percyConfig.variablePrefix);
    expect(
      spans
        .eq(1)
        .children()
        .eq(5)
        .text()
    ).toEqual("flag");
    expect(
      spans
        .eq(1)
        .children()
        .eq(6)
        .text()
    ).toEqual(percyConfig.variableSuffix + '/_{host1}"');

    // Check "${host}$"
    expect(spans.eq(2).children().length).toEqual(3);
    expect(
      spans
        .eq(2)
        .children()
        .eq(0)
        .text()
    ).toEqual('"' + percyConfig.variablePrefix);
    expect(
      spans
        .eq(2)
        .children()
        .eq(1)
        .text()
    ).toEqual("host");
    expect(
      spans
        .eq(2)
        .children()
        .eq(2)
        .text()
    ).toEqual(percyConfig.variableSuffix + '"');

    // Check "${name}$/${age}$"
    expect(spans.eq(3).children().length).toEqual(5);
    expect(
      spans
        .eq(3)
        .children()
        .eq(0)
        .text()
    ).toEqual('"' + percyConfig.variablePrefix);
    expect(
      spans
        .eq(3)
        .children()
        .eq(1)
        .text()
    ).toEqual("name");
    expect(
      spans
        .eq(3)
        .children()
        .eq(2)
        .text()
    ).toEqual(percyConfig.variableSuffix + "/" + percyConfig.variablePrefix);
    expect(
      spans
        .eq(3)
        .children()
        .eq(3)
        .text()
    ).toEqual("age");
    expect(
      spans
        .eq(3)
        .children()
        .eq(4)
        .text()
    ).toEqual(percyConfig.variableSuffix + '"');
  });
});
