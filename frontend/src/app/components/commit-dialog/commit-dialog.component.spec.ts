import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitDialogComponent } from './commit-dialog.component';

describe('CommitDialogComponent', () => {
  let component: CommitDialogComponent;
  let fixture: ComponentFixture<CommitDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CommitDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CommitDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
