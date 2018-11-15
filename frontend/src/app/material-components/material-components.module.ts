import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
  MatSortModule
} from '@angular/material';


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
    MatSortModule
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
    MatSortModule
  ]
})

export class MaterialComponentsModule { }
