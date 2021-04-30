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

import { of } from "rxjs";

import { NgModule } from "@angular/core";
import { LocationStrategy, HashLocationStrategy } from "@angular/common";
import { BrowserModule } from "@angular/platform-browser";

import { MaterialComponentsModule } from "material-components/material-components.module";

import { HIGHLIGHT_OPTIONS } from "ngx-highlightjs";

// components
import { LoaderComponent } from "components/loader/loader.component";
import { AlertDialogComponent } from "components/alert-dialog/alert-dialog.component";
import { ConfirmationDialogComponent } from "components/confirmation-dialog/confirmation-dialog.component";
import { EditorComponent } from "components/editor/editor.component";
import { AddEditPropertyDialogComponent } from "components/add-edit-property-dialog/add-edit-property-dialog.component";
import { NestedConfigViewComponent } from "components/nested-config-view/nested-config-view.component";

// directives
import {
  SplitDirective,
  SplitAreaDirective
} from "directives/splitter.directive";
import { HighlightDirective } from "directives/highlight.directive";

const highlightjs = { default: require("highlight.js/lib/core") };
const yamlLang = { default: require("highlight.js/lib/languages/yaml") };
const jsonLang = { default: require("highlight.js/lib/languages/json") };

@NgModule({
  declarations: [
    LoaderComponent,
    AlertDialogComponent,
    ConfirmationDialogComponent,
    EditorComponent,
    NestedConfigViewComponent,
    AddEditPropertyDialogComponent,
    SplitDirective,
    SplitAreaDirective,
    HighlightDirective
  ],
  imports: [BrowserModule, MaterialComponentsModule],
  exports: [
    LoaderComponent,
    AlertDialogComponent,
    ConfirmationDialogComponent,
    EditorComponent,
    NestedConfigViewComponent,
    AddEditPropertyDialogComponent,
    SplitDirective,
    SplitAreaDirective,
    HighlightDirective,
    BrowserModule,
    MaterialComponentsModule
  ],
  entryComponents: [ConfirmationDialogComponent, AlertDialogComponent],
  providers: [
    {
      provide: HIGHLIGHT_OPTIONS,
      useValue: {
        coreLibraryLoader: () => of(highlightjs),
        languages: {
          yaml: () => of(yamlLang),
          json: () => of(jsonLang)
        }
      }
    },
    { provide: LocationStrategy, useClass: HashLocationStrategy }
  ]
})
export class CommonModule {}
