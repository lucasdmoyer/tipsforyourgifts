import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GiftdetailComponent } from './giftdetail.component';

describe('GiftdetailComponent', () => {
  let component: GiftdetailComponent;
  let fixture: ComponentFixture<GiftdetailComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GiftdetailComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GiftdetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
