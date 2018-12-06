import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Overlay } from '@angular/cdk/overlay';
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
  MatSlideToggleModule,
  MAT_DIALOG_SCROLL_STRATEGY
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
  ],
  providers: [
    {
      provide: MAT_DIALOG_SCROLL_STRATEGY,
      deps: [Overlay],
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.block()
    }
  ]
})

export class MaterialComponentsModule { }
