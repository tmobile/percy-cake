import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditPropertyDialogComponent } from './add-edit-property-dialog.component';

describe('AddEditPropertyDialogComponent', () => {
  let component: AddEditPropertyDialogComponent;
  let fixture: ComponentFixture<AddEditPropertyDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddEditPropertyDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddEditPropertyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
