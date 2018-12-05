import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import * as cheerio from 'cheerio';

import { Setup, TestContext, getVariable } from 'test/test-helper';
import { percyConfig } from 'config';

@Component({
  template: `<pre><code appHighlight [highlight]="previewCode" [languages]="['yaml']"></code></pre>` 
})
class TestHighlightComponent {
  @Input()
  previewCode: string;
}

describe('HighlightDirective', () => {
  const setup = Setup(TestHighlightComponent);

  let ctx: TestContext<TestHighlightComponent>;

  beforeEach(() => {
    ctx = setup();
  });

  it('Should highlight correcly', async () => {
    ctx.component.previewCode = `
default: !!map
  name: !!str "TestUser"
  host: !!str "${getVariable('name')}/${getVariable('age')}/${getVariable('flag')}/_{host1}"
  host1: !!str "${getVariable('host')}" #${getVariable('host')}
  host2: !!str "${getVariable('name')}/${getVariable('age')}"
  api.port: !!int 8080
`
    ctx.detectChanges();
    await ctx.fixture.whenStable();

    const codeEle = ctx.fixture.debugElement.query(By.css('code'));
    
    const $ = cheerio.load(codeEle.properties.innerHTML);
    const spans = $('span.hljs-string');

    // check "TestUser"
    expect(spans.eq(0).text()).toEqual('"TestUser"')

    // Check "${name}$/${age}$/${flag}$/_{host1}"
    expect(spans.eq(1).children().length).toEqual(7)
    expect(spans.eq(1).children().eq(0).text()).toEqual('"' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(1).children().eq(1).text()).toEqual('name')
    expect(spans.eq(1).children().eq(2).text()).toEqual(percyConfig.variableSubstituteSuffix + '/' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(1).children().eq(3).text()).toEqual('age')
    expect(spans.eq(1).children().eq(4).text()).toEqual(percyConfig.variableSubstituteSuffix + '/' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(1).children().eq(5).text()).toEqual('flag')
    expect(spans.eq(1).children().eq(6).text()).toEqual(percyConfig.variableSubstituteSuffix + '/_{host1}"')

    // Check "${host}$"
    expect(spans.eq(2).children().length).toEqual(3)
    expect(spans.eq(2).children().eq(0).text()).toEqual('"' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(2).children().eq(1).text()).toEqual('host')
    expect(spans.eq(2).children().eq(2).text()).toEqual(percyConfig.variableSubstituteSuffix + '"')

    // Check "${name}$/${age}$"
    expect(spans.eq(3).children().length).toEqual(5)
    expect(spans.eq(3).children().eq(0).text()).toEqual('"' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(3).children().eq(1).text()).toEqual('name')
    expect(spans.eq(3).children().eq(2).text()).toEqual(percyConfig.variableSubstituteSuffix + '/' + percyConfig.variableSubstitutePrefix)
    expect(spans.eq(3).children().eq(3).text()).toEqual('age')
    expect(spans.eq(3).children().eq(4).text()).toEqual(percyConfig.variableSubstituteSuffix + '"')
  })
  
})
