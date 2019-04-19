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

import { NgModule } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  MatListModule,
  MatAutocompleteModule,
  MatCardModule,
  MatButtonModule,
  MatInputModule,
  MatTableModule,
  MatSelectModule,
  MatDialogModule,
  MatDividerModule,
  MatTabsModule,
  MatTreeModule,
  MatMenuModule,
  MatRadioModule,
  MatTooltipModule,
  MatCheckboxModule,
  MatExpansionModule,
  MatIconModule,
  MatSortModule,
  MatSlideToggleModule
} from "@angular/material";

@NgModule({
  imports: [
    MatListModule,
    MatAutocompleteModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatSelectModule,
    MatDialogModule,
    MatDividerModule,
    MatTabsModule,
    MatTreeModule,
    MatMenuModule,
    MatRadioModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatIconModule,
    MatSortModule,
    MatSlideToggleModule
  ],
  exports: [
    MatListModule,
    MatAutocompleteModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatSelectModule,
    MatDialogModule,
    MatDividerModule,
    MatTabsModule,
    MatTreeModule,
    MatMenuModule,
    MatRadioModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatIconModule,
    MatSortModule,
    MatSlideToggleModule
  ]
})
export class MaterialComponentsModule {}
