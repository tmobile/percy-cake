import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ConflictDialogComponent } from './conflict-dialog.component';

describe('ConflictDialogComponent', () => {
  let component: ConflictDialogComponent;
  let fixture: ComponentFixture<ConflictDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ConflictDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ConflictDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
